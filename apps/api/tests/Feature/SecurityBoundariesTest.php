<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Billing\Services\BillingCatalog;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SecurityBoundariesTest extends TestCase
{
    use RefreshDatabase;

    public function test_forged_bearer_token_is_rejected_without_enabling_personal_access_tokens(): void
    {
        $this->withHeader('Authorization', 'Bearer 1|forged-synthetic-token')->getJson('/api/v1/auth/user')->assertUnauthorized();
    }

    public function test_mutation_without_csrf_is_rejected_outside_unit_test_bypass(): void
    {
        $this->app['env'] = 'local';
        $this->postJson('/api/v1/auth/login', ['email' => 'synthetic@example.test', 'password' => 'anything'])->assertStatus(419);
        $this->get('/sanctum/csrf-cookie')->assertNoContent()->assertCookie('XSRF-TOKEN');
        $this->app['env'] = 'testing';
    }

    public function test_authentication_rate_limit_prevents_repeated_guesses(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'synthetic@example.test', 'password' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/api/v1/auth/login', ['email' => 'synthetic@example.test', 'password' => 'wrong'])->assertStatus(429);
    }

    public function test_invite_acceptance_checks_email_and_transfer_preserves_an_owner(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner)->postJson('/api/v1/onboarding', ['name' => 'Organização sintética', 'slug' => 'invite-test'])->assertCreated();
        $organization = Organization::firstOrFail();
        $employee = User::factory()->create(['email' => 'employee@synthetic.test']);
        $token = $this->postJson('/api/v1/memberships/invitations', ['email' => $employee->email, 'role' => 'employee'])->assertCreated()->json('data.invitation_token');
        $impostor = User::factory()->create();
        $this->actingAs($impostor)->postJson('/api/v1/memberships/accept', ['token' => $token])->assertNotFound();
        $id = $this->actingAs($employee)->postJson('/api/v1/memberships/accept', ['token' => $token])->assertOk()->json('data.id');
        $this->postJson('/api/v1/memberships/accept', ['token' => $token])->assertNotFound();
        $this->actingAs($owner)->withSession(['organization_id' => $organization->id])->postJson('/api/v1/memberships/transfer', ['membership_id' => $id])->assertOk();
        $this->assertDatabaseHas('organizations', ['id' => $organization->id, 'owner_id' => $employee->id]);
        $this->assertDatabaseHas('memberships', ['id' => $id, 'role' => 'owner', 'status' => 'active']);
        $this->assertDatabaseHas('memberships', ['user_id' => $owner->id, 'role' => 'admin']);
        $this->actingAs($employee)->withSession(['organization_id' => $organization->id])->deleteJson('/api/v1/memberships/'.$id)->assertConflict();
    }

    public function test_employee_can_manage_only_a_linked_professional_and_iso_milliseconds_are_accepted(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner)->postJson('/api/v1/onboarding', ['name' => 'Organização sintética', 'slug' => 'employee-test'])->assertCreated();
        $organization = Organization::firstOrFail();
        // O cenário de autorização exige dois profissionais; o Starter mantém o limite de um.
        DB::table('subscriptions')->where('organization_id', $organization->id)
            ->update(['plan_version_id' => app(BillingCatalog::class)->version('pro')->id]);
        $employee = User::factory()->create();
        $membership = Membership::create(['user_id' => $employee->id, 'organization_id' => $organization->id, 'role' => 'employee', 'status' => 'active']);
        $service = $this->postJson('/api/v1/services', ['name' => 'Serviço sintético', 'duration_minutes' => 30, 'price_cents' => 3000])->assertCreated()->json('data.id');
        $customer = $this->postJson('/api/v1/customers', ['name' => 'Cliente sintético'])->assertCreated()->json('data.id');
        $own = $this->postJson('/api/v1/professionals', ['name' => 'Profissional próprio', 'membership_id' => $membership->id])->assertCreated()->json('data.id');
        $other = $this->postJson('/api/v1/professionals', ['name' => 'Outro profissional'])->assertCreated()->json('data.id');
        $date = now()->addWeek()->nextWeekday()->setTime(13, 0)->utc()->format('Y-m-d\TH:i:s.v\Z');
        $payload = ['service_id' => $service, 'customer_id' => $customer, 'professional_id' => $other, 'start_time' => $date];
        $this->actingAs($employee)->withSession(['organization_id' => $organization->id])->postJson('/api/v1/appointments', $payload)->assertForbidden();
        $this->postJson('/api/v1/appointments', [...$payload, 'professional_id' => $own])->assertCreated();
    }

    public function test_password_recovery_uses_hashed_one_time_token_and_changes_credentials(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'recovery@synthetic.test', 'password' => 'synthetic-old-password']);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();
        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function ($notification) use (&$token) {
            $token = $notification->token;

            return true;
        });
        $this->assertNotSame($token, DB::table('password_reset_tokens')->where('email', $user->email)->value('token'));
        $payload = ['email' => $user->email, 'token' => $token, 'password' => 'synthetic-new-password', 'password_confirmation' => 'synthetic-new-password'];
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertOk();
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertUnprocessable();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'synthetic-old-password'])->assertUnprocessable();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'synthetic-new-password', 'remember' => true])->assertOk();
    }
}
