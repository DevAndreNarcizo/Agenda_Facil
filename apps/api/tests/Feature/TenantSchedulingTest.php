<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Scheduling\Models\Appointment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantSchedulingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-02T10:00:00-03:00'));
        $this->travelTo(CarbonImmutable::now());
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function organization(string $slug): array
    {
        $user = User::factory()->create(['email' => $slug.'@synthetic.test']);
        $this->actingAs($user)->postJson('/api/v1/onboarding', ['name' => 'Organização '.$slug, 'slug' => $slug])->assertCreated();

        return [$user, Organization::where('slug', $slug)->firstOrFail()];
    }

    private function catalog(User $user, Organization $organization): array
    {
        $this->actingAs($user)->withSession(['organization_id' => $organization->id]);
        $service = $this->postJson('/api/v1/services', ['name' => 'Serviço sintético', 'duration_minutes' => 60, 'price_cents' => 9000])->assertCreated()->json('data.id');
        $professional = $this->postJson('/api/v1/professionals', ['name' => 'Profissional sintético'])->assertCreated()->json('data.id');
        $customer = $this->postJson('/api/v1/customers', ['name' => 'Cliente sintético'])->assertCreated()->json('data.id');

        return ['service_id' => $service, 'professional_id' => $professional, 'customer_id' => $customer, 'start_time' => '2026-11-03T12:00:00+00:00'];
    }

    public function test_registration_rejects_role_and_tenant_spoofing_and_requires_strong_password(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Sintético', 'email' => 'novo@synthetic.test', 'password' => '123456789012', 'password_confirmation' => '123456789012', 'role' => 'owner'])->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->postJson('/api/v1/auth/register', ['name' => 'Sintético', 'email' => 'novo@synthetic.test', 'password' => 'synthetic-password-123', 'password_confirmation' => 'synthetic-password-123'])->assertCreated()->assertJsonPath('data.organization', null);
        $this->getJson('/api/v1/auth/user')->assertOk()->assertJsonPath('data.user.email', 'novo@synthetic.test');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->getJson('/api/v1/auth/user')->assertUnauthorized();
    }

    public function test_onboarding_is_idempotent_and_membership_controls_tenant(): void
    {
        [$user, $organization] = $this->organization('alpha');
        $this->actingAs($user)->postJson('/api/v1/onboarding', ['name' => 'Outro nome', 'slug' => 'outra'])->assertCreated()->assertJsonPath('data.id', $organization->id);
        $this->assertDatabaseCount('organizations', 1);
        $this->assertDatabaseCount('subscriptions', 1);
        $this->assertDatabaseHas('memberships', ['organization_id' => $organization->id, 'user_id' => $user->id, 'role' => 'owner']);
        $this->patchJson('/api/v1/settings', ['owner_id' => User::factory()->create()->id])->assertUnprocessable();
        Membership::where('user_id', $user->id)->update(['status' => 'revoked']);
        $this->getJson('/api/v1/services')->assertForbidden();
    }

    public function test_two_tenants_are_isolated_even_with_forged_headers_and_resource_ids(): void
    {
        [$a, $orgA] = $this->organization('alpha');
        $payload = $this->catalog($a, $orgA);
        [$b, $orgB] = $this->organization('beta');
        $this->actingAs($b)->withSession(['organization_id' => $orgB->id])->withHeader('X-Organization-Id', $orgA->id);
        $this->getJson('/api/v1/services')->assertOk()->assertJsonCount(0, 'data');
        $this->patchJson('/api/v1/services/'.$payload['service_id'], ['name' => 'Ataque'])->assertNotFound();
        $this->deleteJson('/api/v1/customers/'.$payload['customer_id'])->assertNotFound();
        $this->postJson('/api/v1/appointments', $payload)->assertNotFound();
        $this->postJson('/api/v1/services', ['name' => 'Ataque', 'duration_minutes' => 30, 'price_cents' => 0, 'organization_id' => $orgA->id])->assertUnprocessable();
    }

    public function test_booking_uses_server_price_and_prevents_overlap_including_completed(): void
    {
        [$user, $organization] = $this->organization('alpha');
        $payload = $this->catalog($user, $organization);
        $this->postJson('/api/v1/appointments', [...$payload, 'price_cents' => 1])->assertUnprocessable();
        $id = $this->postJson('/api/v1/appointments', $payload)->assertCreated()->assertJsonPath('data.price_cents', 9000)->json('data.id');
        $this->postJson('/api/v1/appointments', $payload)->assertConflict();
        $this->patchJson('/api/v1/appointments/'.$id, ['status' => 'completed'])->assertUnprocessable();
        $this->patchJson('/api/v1/appointments/'.$id, ['status' => 'confirmed'])->assertOk();
        $this->patchJson('/api/v1/appointments/'.$id, ['status' => 'completed'])->assertOk();
        $this->postJson('/api/v1/appointments', $payload)->assertConflict();
        $this->patchJson('/api/v1/appointments/'.$id, ['status' => 'confirmed'])->assertUnprocessable();
    }

    public function test_public_new_customer_can_book_idempotently_and_cancel_with_secret(): void
    {
        [$user, $organization] = $this->organization('alpha');
        $payload = $this->catalog($user, $organization);
        unset($payload['customer_id']);
        $payload['customer'] = ['name' => 'Cliente externo sintético', 'email' => 'externo@synthetic.test'];
        $this->postJson('/api/v1/auth/logout');
        $response = $this->withHeader('Idempotency-Key', 'public-test-key-123456')->postJson('/api/v1/public/alpha/bookings', $payload)->assertCreated();
        $id = $response->json('data.id');
        $token = $response->json('data.cancellation_token');
        $this->postJson('/api/v1/public/alpha/bookings', $payload)->assertCreated()->assertJsonPath('data.id', $id);
        $this->assertDatabaseCount('appointments', 1);
        $this->assertDatabaseCount('customers', 2);
        $this->getJson('/api/v1/public/alpha')->assertOk()->assertJsonMissingPath('data.organization.owner_id');
        $this->postJson('/api/v1/public/alpha/bookings/'.$id.'/cancel', ['token' => str_repeat('a', 64)])->assertNotFound();
        $this->postJson('/api/v1/public/alpha/bookings/'.$id.'/cancel', ['token' => $token])->assertOk();
        $this->assertDatabaseHas('appointments', ['id' => $id, 'status' => 'cancelled']);
    }

    public function test_timezone_hours_availability_and_cross_tenant_public_resources(): void
    {
        [$a, $orgA] = $this->organization('alpha');
        $payload = $this->catalog($a, $orgA);
        $this->postJson('/api/v1/appointments', [...$payload, 'start_time' => '2026-11-03T10:00:00+00:00'])->assertUnprocessable();
        $this->getJson('/api/v1/public/alpha/availability?'.http_build_query(['service_id' => $payload['service_id'], 'professional_id' => $payload['professional_id'], 'date' => '2026-11-03']))->assertOk()->assertJsonPath('data.0', '2026-11-03T12:00:00+00:00');
        $this->organization('beta');
        $public = $payload;
        unset($public['customer_id']);
        $public['customer'] = ['name' => 'Cliente sintético'];
        $this->postJson('/api/v1/public/beta/bookings', $public)->assertNotFound();
    }

    public function test_database_constraint_and_composite_foreign_keys_are_defense_in_depth(): void
    {
        [$user, $organization] = $this->organization('alpha');
        $payload = $this->catalog($user, $organization);
        $this->postJson('/api/v1/appointments', $payload)->assertCreated();
        $copy = Appointment::first()->replicate();
        $this->expectException(QueryException::class);
        $copy->save();
    }

    public function test_last_owner_cannot_be_revoked_and_employee_cannot_manage_catalog(): void
    {
        [$owner, $organization] = $this->organization('alpha');
        $membership = Membership::where('user_id', $owner->id)->first();
        $this->deleteJson('/api/v1/memberships/'.$membership->id)->assertConflict();
        $employee = User::factory()->create();
        Membership::create(['user_id' => $employee->id, 'organization_id' => $organization->id, 'role' => 'employee', 'status' => 'active']);
        $this->actingAs($employee)->withSession(['organization_id' => $organization->id])->postJson('/api/v1/services', ['name' => 'Serviço', 'duration_minutes' => 30, 'price_cents' => 0])->assertForbidden();
        $this->postJson('/api/v1/onboarding', ['name' => 'Ataque', 'slug' => 'ataque'])->assertForbidden();
    }
}
