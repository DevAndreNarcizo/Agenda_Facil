<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Customers\Models\Customer;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

final class SchedulingBlocksTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-11-02T10:00:00-03:00'));
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        parent::tearDown();
    }

    private function fixture(string $slug): array
    {
        $owner = User::factory()->create();
        $organization = app(CompleteOnboarding::class)->execute($owner, ['name' => 'Agenda sintética', 'slug' => $slug]);
        $service = Service::forceCreate(['organization_id' => $organization->id, 'name' => 'Serviço sintético', 'duration_minutes' => 30, 'price_cents' => 5000]);
        $professional = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Profissional sintético']);
        $customer = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Cliente sintético', 'email' => 'cliente@'.$slug.'.test']);
        $this->actingAs($owner)->withSession(['organization_id' => $organization->id]);

        return [$owner, $organization, ['service_id' => $service->id, 'professional_id' => $professional->id, 'customer_id' => $customer->id, 'start_time' => '2026-11-03T12:00:00+00:00']];
    }

    private function interval(?string $professionalId = null): array
    {
        return ['professional_id' => $professionalId, 'start_time' => '2026-11-03T12:00:00+00:00', 'end_time' => '2026-11-03T13:00:00+00:00'];
    }

    public function test_global_block_is_idempotent_and_omits_public_slots_for_every_professional(): void
    {
        [, $organization, $booking] = $this->fixture('alpha');
        $second = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Segundo profissional sintético']);
        $id = $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertCreated()->json('data.id');
        $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertCreated()->assertJsonPath('data.id', $id);
        $this->assertDatabaseCount('appointment_blocks', 1);
        foreach ([$booking['professional_id'], $second->id] as $professionalId) {
            $this->postJson('/api/v1/appointments', [...$booking, 'professional_id' => $professionalId])->assertConflict();
            $query = http_build_query(['service_id' => $booking['service_id'], 'professional_id' => $professionalId, 'date' => '2026-11-03']);
            $response = $this->getJson('/api/v1/public/alpha/availability?'.$query)->assertOk();
            $this->assertNotContains('2026-11-03T12:00:00+00:00', $response->json('data'));
            $this->assertContains('2026-11-03T13:00:00+00:00', $response->json('data'));
        }
        $this->deleteJson('/api/v1/appointment-blocks/'.$id)->assertOk();
        $this->postJson('/api/v1/appointments', $booking)->assertCreated();
    }

    public function test_professional_block_does_not_block_other_professionals_or_other_tenants(): void
    {
        [$owner, $organization, $booking] = $this->fixture('alpha');
        $second = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Segundo profissional sintético']);
        $id = $this->postJson('/api/v1/appointment-blocks', $this->interval($booking['professional_id']))->assertCreated()->json('data.id');
        $this->postJson('/api/v1/appointments', $booking)->assertConflict();
        $this->postJson('/api/v1/appointments', [...$booking, 'professional_id' => $second->id])->assertCreated();
        [, , $otherBooking] = $this->fixture('beta');
        $this->getJson('/api/v1/appointment-blocks')->assertJsonCount(0, 'data');
        $this->deleteJson('/api/v1/appointment-blocks/'.$id)->assertNotFound();
        $this->postJson('/api/v1/appointment-blocks', $this->interval($booking['professional_id']))->assertNotFound();
        $this->postJson('/api/v1/appointments', $otherBooking)->assertCreated();
        $this->actingAs($owner)->withSession(['organization_id' => $organization->id]);
        $this->postJson('/api/v1/appointment-blocks', [...$this->interval(), 'organization_id' => (string) Str::uuid()])->assertUnprocessable();
    }

    public function test_a_block_cannot_hide_existing_appointments_or_use_an_invalid_interval(): void
    {
        [, , $booking] = $this->fixture('alpha');
        $id = $this->postJson('/api/v1/appointments', $booking)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertConflict();
        $this->postJson('/api/v1/appointment-blocks', $this->interval($booking['professional_id']))->assertConflict();
        $this->postJson('/api/v1/appointment-blocks', [...$this->interval(), 'end_time' => '2026-11-03T11:00:00+00:00'])->assertUnprocessable();
        $this->postJson('/api/v1/appointment-blocks', [...$this->interval(), 'start_time' => '2026-11-01T12:00:00+00:00'])->assertUnprocessable();
        $this->patchJson('/api/v1/appointments/'.$id, ['status' => 'cancelled'])->assertOk();
        $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertCreated();
    }

    public function test_employee_can_manage_only_the_block_of_their_linked_professional(): void
    {
        [$owner, $organization, $booking] = $this->fixture('alpha');
        $globalId = $this->postJson('/api/v1/appointment-blocks', ['professional_id' => null, 'start_time' => '2026-11-03T14:00:00+00:00', 'end_time' => '2026-11-03T15:00:00+00:00'])->assertCreated()->json('data.id');
        $employee = User::factory()->create();
        $membership = Membership::create(['organization_id' => $organization->id, 'user_id' => $employee->id, 'role' => 'employee', 'status' => 'active']);
        $own = Professional::forceCreate(['organization_id' => $organization->id, 'membership_id' => $membership->id, 'name' => 'Profissional vinculado']);
        $this->actingAs($employee)->withSession(['organization_id' => $organization->id]);
        $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertForbidden();
        $this->postJson('/api/v1/appointment-blocks', $this->interval($booking['professional_id']))->assertForbidden();
        $this->deleteJson('/api/v1/appointment-blocks/'.$globalId)->assertForbidden();
        $id = $this->postJson('/api/v1/appointment-blocks', $this->interval($own->id))->assertCreated()->json('data.id');
        $this->deleteJson('/api/v1/appointment-blocks/'.$id)->assertOk();
        $this->actingAs($owner)->withSession(['organization_id' => $organization->id]);
        DB::table('subscriptions')->where('organization_id', $organization->id)->update(['status' => 'suspended']);
        $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertForbidden();
        $this->deleteJson('/api/v1/appointment-blocks/'.$globalId)->assertOk();
    }

    public function test_shared_booking_action_used_by_the_portal_rejects_a_block_without_consumption(): void
    {
        [, $organization, $booking] = $this->fixture('alpha');
        $this->postJson('/api/v1/appointment-blocks', $this->interval())->assertCreated();
        try {
            app(BookAppointment::class)->execute($organization, $booking, null, 'portal-shared-block-12345');
            $this->fail('A ação central não deveria reservar um intervalo bloqueado.');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }
        $this->assertDatabaseCount('appointments', 0);
        $this->assertDatabaseCount('usage_counters', 0);
    }
}
