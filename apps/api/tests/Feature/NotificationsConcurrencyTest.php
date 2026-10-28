<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Customers\Models\Customer;
use App\Domains\Notifications\Contracts\NotificationChannel;
use App\Domains\Notifications\Data\DeliveryReceipt;
use App\Domains\Notifications\Data\NotificationMessage;
use App\Domains\Notifications\Services\DeliveryWorker;
use App\Domains\Notifications\Services\OutboxService;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class NotificationsConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    public static function workerScenarios(): array
    {
        return ['mesma entrega' => [false], 'duas entregas disputam a última cota' => [true]];
    }

    #[DataProvider('workerScenarios')]
    public function test_workers_do_not_duplicate_a_delivery_or_exceed_message_quota(bool $twoAppointments): void
    {
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('pcntl é necessário para provar concorrência real de workers.');
        }
        $this->travelTo(CarbonImmutable::parse('2026-11-02T10:00:00-03:00'));
        $path = tempnam(sys_get_temp_dir(), 'agenda-notification-concurrency-');
        try {
            config(['notifications.enabled' => true, 'notifications.homologated' => true]);
            $organization = app(CompleteOnboarding::class)->execute(User::factory()->create(), ['name' => 'Concorrência sintética', 'slug' => 'notifications-concurrent']);
            $version = DB::table('subscriptions')->where('organization_id', $organization->id)->value('plan_version_id');
            DB::table('plan_entitlements')->where('plan_version_id', $version)->where('resource', 'messages')->update(['limit_value' => 1]);
            $service = Service::forceCreate(['organization_id' => $organization->id, 'name' => 'Serviço sintético', 'duration_minutes' => 30, 'price_cents' => 5000]);
            $professional = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Profissional sintético']);
            $customer = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Cliente sintético', 'phone' => '11999990000']);
            $appointment = app(BookAppointment::class)->execute($organization, ['service_id' => $service->id, 'professional_id' => $professional->id, 'customer_id' => $customer->id, 'start_time' => '2026-11-03T12:00:00+00:00']);
            $appointment->update(['status' => 'confirmed']);
            app(OutboxService::class)->synchronize($appointment);
            if ($twoAppointments) {
                $second = app(BookAppointment::class)->execute($organization, ['service_id' => $service->id, 'professional_id' => $professional->id, 'customer_id' => $customer->id, 'start_time' => '2026-11-03T12:30:00+00:00']);
                $second->update(['status' => 'confirmed']);
                app(OutboxService::class)->synchronize($second);
            }
            DB::disconnect();
            $children = [];
            for ($index = 0; $index < 2; $index++) {
                $pid = pcntl_fork();
                $this->assertNotSame(-1, $pid);
                if ($pid === 0) {
                    DB::purge();
                    $channel = new class($path) implements NotificationChannel
                    {
                        public function __construct(private string $path) {}

                        public function assertAvailable(): void {}

                        public function send(NotificationMessage $message, string $idempotencyKey): DeliveryReceipt
                        {
                            file_put_contents($this->path, $idempotencyKey."\n", FILE_APPEND | LOCK_EX);
                            usleep(200_000);

                            return new DeliveryReceipt('concurrent_receipt');
                        }
                    };
                    try {
                        (new DeliveryWorker($channel))->deliverBatch(25, $organization->id);
                        exit(0);
                    } catch (\Throwable) {
                        exit(6);
                    }
                }
                $children[] = $pid;
            }
            foreach ($children as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertTrue(pcntl_wifexited($status));
                $this->assertSame(0, pcntl_wexitstatus($status));
            }
            DB::purge();
            $this->assertCount(1, file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
            $this->assertSame(1, DB::table('message_deliveries')->where('organization_id', $organization->id)->where('status', 'sent')->count());
            if ($twoAppointments) {
                $this->assertDatabaseHas('message_deliveries', ['organization_id' => $organization->id, 'status' => 'failed', 'error_code' => 'message_quota_unavailable']);
            }
            $this->assertSame(1, (int) DB::table('usage_counters')->where('organization_id', $organization->id)->where('resource', 'messages')->value('consumed'));
        } finally {
            unlink($path);
            $this->travelBack();
        }
    }
}
