<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Customers\Models\Customer;
use App\Domains\Notifications\Contracts\NotificationChannel;
use App\Domains\Notifications\Data\DeliveryReceipt;
use App\Domains\Notifications\Data\NotificationMessage;
use App\Domains\Notifications\Exceptions\DeliveryRejected;
use App\Domains\Notifications\Services\DeliveryWorker;
use App\Domains\Notifications\Services\OutboxService;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-11-02T10:00:00-03:00'));
        config(['notifications.enabled' => true, 'notifications.homologated' => true]);
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        parent::tearDown();
    }

    private function fixture(string $slug = 'notifications-alpha', bool $confirmed = true): array
    {
        $owner = User::factory()->create();
        $organization = app(CompleteOnboarding::class)->execute($owner, ['name' => 'Notificações sintéticas', 'slug' => $slug]);
        $version = DB::table('subscriptions')->where('organization_id', $organization->id)->value('plan_version_id');
        DB::table('plan_entitlements')->where('plan_version_id', $version)->where('resource', 'messages')->update(['limit_value' => 10]);
        $service = Service::forceCreate(['organization_id' => $organization->id, 'name' => 'Serviço sintético', 'duration_minutes' => 30, 'price_cents' => 5000]);
        $professional = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Profissional sintético']);
        $customer = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Cliente sintético', 'phone' => '11999990000']);
        $appointment = app(BookAppointment::class)->execute($organization, ['service_id' => $service->id, 'professional_id' => $professional->id, 'customer_id' => $customer->id, 'start_time' => '2026-11-03T12:00:00+00:00']);
        $this->actingAs($owner)->withSession(['organization_id' => $organization->id]);
        if ($confirmed) {
            $this->patchJson('/api/v1/appointments/'.$appointment->id, ['status' => 'confirmed'])->assertOk();
            $appointment->refresh();
        }

        return [$organization, $appointment, $customer];
    }

    private function channel(string $mode = 'sent'): NotificationChannel
    {
        return new class($mode) implements NotificationChannel
        {
            public int $calls = 0;

            public array $keys = [];

            public function __construct(public string $mode) {}

            public function assertAvailable(): void {}

            public function send(NotificationMessage $message, string $idempotencyKey): DeliveryReceipt
            {
                $this->calls++;
                $this->keys[] = $idempotencyKey;
                if ($this->mode === 'rejected') {
                    throw new DeliveryRejected;
                }
                if ($this->mode === 'uncertain') {
                    throw new \RuntimeException('synthetic-secret-recipient-11999990000');
                }

                return new DeliveryReceipt('synthetic_message_123');
            }
        };
    }

    public function test_confirmation_enqueues_once_and_rescheduling_updates_the_same_delivery(): void
    {
        [, $appointment] = $this->fixture(confirmed: false);
        $this->assertDatabaseCount('message_deliveries', 0);
        $this->patchJson('/api/v1/appointments/'.$appointment->id, ['status' => 'confirmed'])->assertOk();
        $this->patchJson('/api/v1/appointments/'.$appointment->id, ['status' => 'confirmed'])->assertOk();
        $id = DB::table('message_deliveries')->value('id');
        $this->assertDatabaseCount('message_deliveries', 1);
        $this->assertSame('2026-11-02T12:00:00+00:00', CarbonImmutable::parse(DB::table('message_deliveries')->value('due_at'))->toIso8601String());
        $this->patchJson('/api/v1/appointments/'.$appointment->id, ['start_time' => '2026-11-04T12:00:00+00:00'])->assertOk();
        $this->assertSame($id, DB::table('message_deliveries')->value('id'));
        $this->assertSame('2026-11-03T12:00:00+00:00', CarbonImmutable::parse(DB::table('message_deliveries')->value('due_at'))->toIso8601String());
        $this->assertSame([], app(OutboxService::class)->claim());
    }

    public function test_booking_rollback_also_rolls_back_the_notification_outbox(): void
    {
        [, $appointment] = $this->fixture(confirmed: false);
        try {
            DB::transaction(function () use ($appointment): void {
                $appointment->update(['status' => 'confirmed']);
                app(OutboxService::class)->synchronize($appointment);
                throw new \RuntimeException('synthetic rollback');
            });
            $this->fail('A transação deveria ser revertida.');
        } catch (\RuntimeException) {
            $this->assertDatabaseHas('appointments', ['id' => $appointment->id, 'status' => 'pending']);
            $this->assertDatabaseCount('message_deliveries', 0);
        }
    }

    public function test_delivery_and_receipt_replay_consume_quota_once_without_persisting_personal_payload(): void
    {
        [$organization, $appointment] = $this->fixture();
        $channel = $this->channel();
        $worker = new DeliveryWorker($channel);
        $this->assertSame(1, $worker->deliverBatch()['sent']);
        $this->assertSame(0, $worker->deliverBatch()['sent']);
        app(OutboxService::class)->synchronize($appointment);
        $this->assertSame(1, $channel->calls);
        $this->assertSame(1, (int) DB::table('usage_counters')->where('organization_id', $organization->id)->where('resource', 'messages')->value('consumed'));
        $this->assertNotNull($appointment->refresh()->reminder_sent_at);
        $stored = json_encode(DB::table('message_deliveries')->get(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('11999990000', $stored);
        $this->assertStringNotContainsString('Cliente sintético', $stored);
    }

    public function test_known_rejection_retries_with_backoff_and_same_key_without_double_quota(): void
    {
        [$organization] = $this->fixture();
        $channel = $this->channel('rejected');
        $worker = new DeliveryWorker($channel);
        $this->assertSame(1, $worker->deliverBatch()['failed']);
        $this->assertSame(0, $worker->deliverBatch()['failed']);
        $this->travel(3)->minutes();
        $channel->mode = 'sent';
        $this->assertSame(1, $worker->deliverBatch()['sent']);
        $this->assertSame(2, $channel->calls);
        $this->assertSame($channel->keys[0], $channel->keys[1]);
        $this->assertSame(1, (int) DB::table('usage_counters')->where('organization_id', $organization->id)->where('resource', 'messages')->value('consumed'));
    }

    public function test_transport_uncertainty_never_automatically_retries_or_persists_exception_data(): void
    {
        $this->fixture();
        $channel = $this->channel('uncertain');
        $worker = new DeliveryWorker($channel);
        $this->assertSame(1, $worker->deliverBatch()['unknown']);
        $this->travel(1)->hours();
        app(OutboxService::class)->enqueueReminders();
        $worker->deliverBatch();
        $this->assertSame(1, $channel->calls);
        $this->assertDatabaseHas('message_deliveries', ['status' => 'unknown', 'error_code' => 'provider_delivery_uncertain']);
        $this->assertStringNotContainsString('synthetic-secret', json_encode(DB::table('message_deliveries')->get(), JSON_THROW_ON_ERROR));
    }

    public function test_expired_pre_dispatch_lease_is_recoverable_and_old_worker_cannot_finalize(): void
    {
        [$organization] = $this->fixture();
        $outbox = app(OutboxService::class);
        $first = $outbox->claim()[0];
        $this->travel(11)->minutes();
        $this->assertSame(['unknown' => 0, 'retried' => 1], $outbox->recoverExpiredLeases());
        $second = $outbox->claim()[0];
        $worker = new DeliveryWorker($this->channel());
        $this->assertNull($worker->prepare($first->id, $organization->id, $first->lease_token));
        $this->assertNotNull($worker->prepare($second->id, $organization->id, $second->lease_token));
        $this->assertFalse($worker->complete($first->id, $organization->id, $first->lease_token, new DeliveryReceipt('old_receipt')));
        $this->assertTrue($worker->complete($second->id, $organization->id, $second->lease_token, new DeliveryReceipt('current_receipt')));
        $this->assertFalse($worker->complete($second->id, $organization->id, $second->lease_token, new DeliveryReceipt('current_receipt')));
    }

    public function test_crash_after_dispatch_stays_unknown_and_scan_preserves_an_unchanged_active_lease(): void
    {
        [$organization] = $this->fixture();
        $outbox = app(OutboxService::class);
        $delivery = $outbox->claim()[0];
        $worker = new DeliveryWorker($this->channel());
        $this->assertNotNull($worker->prepare($delivery->id, $organization->id, $delivery->lease_token));
        $outbox->enqueueReminders();
        $this->assertDatabaseHas('message_deliveries', ['id' => $delivery->id, 'status' => 'processing', 'lease_token' => $delivery->lease_token]);
        $this->travel(11)->minutes();
        $this->assertSame(['unknown' => 1, 'retried' => 0], $outbox->recoverExpiredLeases());
        $this->assertSame([], $outbox->claim());
        $this->assertFalse($worker->complete($delivery->id, $organization->id, $delivery->lease_token, new DeliveryReceipt('late_receipt')));
    }

    public function test_cancellation_before_dispatch_prevents_provider_call_even_after_claim(): void
    {
        [$organization, $appointment] = $this->fixture();
        $delivery = app(OutboxService::class)->claim()[0];
        $this->patchJson('/api/v1/appointments/'.$appointment->id, ['status' => 'cancelled'])->assertOk();
        $channel = $this->channel();
        $worker = new DeliveryWorker($channel);
        $this->assertNull($worker->prepare($delivery->id, $organization->id, $delivery->lease_token));
        $worker->deliverBatch();
        $this->assertSame(0, $channel->calls);
        $this->assertDatabaseHas('message_deliveries', ['id' => $delivery->id, 'status' => 'cancelled']);
        $this->assertDatabaseMissing('usage_counters', ['resource' => 'messages']);
    }

    public function test_unavailable_quota_prevents_dispatch_and_is_rechecked_after_regularization(): void
    {
        [$organization] = $this->fixture();
        DB::table('plan_entitlements')->where('resource', 'messages')->update(['limit_value' => 0]);
        $channel = $this->channel();
        $worker = new DeliveryWorker($channel);
        $this->assertSame(1, $worker->deliverBatch()['failed']);
        $this->assertSame(0, $channel->calls);
        $this->assertDatabaseHas('message_deliveries', ['error_code' => 'message_quota_unavailable']);
        $this->assertDatabaseMissing('usage_counters', ['resource' => 'messages']);
        DB::table('plan_entitlements')->where('resource', 'messages')->update(['limit_value' => 1]);
        $this->travel(61)->minutes();
        $this->assertSame(1, $worker->deliverBatch()['sent']);
        $this->assertSame(1, (int) DB::table('usage_counters')->where('organization_id', $organization->id)->where('resource', 'messages')->value('consumed'));
    }

    public function test_tenant_scope_rejects_claim_prepare_and_forged_appointment_tenant(): void
    {
        [$alpha, $appointment] = $this->fixture();
        [$beta] = $this->fixture('notifications-beta', false);
        $outbox = app(OutboxService::class);
        $this->assertSame([], $outbox->claim(25, $beta->id));
        $delivery = $outbox->claim(25, $alpha->id)[0];
        $worker = new DeliveryWorker($this->channel());
        $this->assertNull($worker->prepare($delivery->id, $beta->id, $delivery->lease_token));
        $forged = clone $appointment;
        $forged->organization_id = $beta->id;
        try {
            $outbox->synchronize($forged);
            $this->fail('Um agendamento não pode ser associado a outro tenant.');
        } catch (ModelNotFoundException) {
            $this->assertDatabaseCount('message_deliveries', 1);
        }
    }

    public function test_command_and_scheduler_gates_remain_closed_without_homologation_or_real_channel(): void
    {
        config(['notifications.enabled' => false, 'notifications.homologated' => false]);
        $this->artisan('notifications:enqueue-reminders')->assertExitCode(1);
        $this->artisan('notifications:deliver')->assertExitCode(1);
        $events = collect(app(Schedule::class)->events())->filter(fn ($event) => str_contains((string) $event->command, 'notifications:'));
        $this->assertCount(2, $events);
        foreach ($events as $event) {
            $this->assertFalse($event->filtersPass($this->app));
        }
        config(['notifications.enabled' => true, 'notifications.homologated' => true]);
        $this->artisan('notifications:deliver')->assertExitCode(1);
        Http::assertNothingSent();
    }
}
