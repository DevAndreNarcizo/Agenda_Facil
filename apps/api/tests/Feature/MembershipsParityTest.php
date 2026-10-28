<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Billing\Services\BillingCatalog;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class MembershipsParityTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        $this->travelBack();
        parent::tearDown();
    }

    private function tenant(string $slug): array
    {
        $owner = User::factory()->create(['name' => 'Owner sintético '.$slug, 'email' => $slug.'-owner@example.test']);
        $id = $this->actingAs($owner)->postJson('/api/v1/onboarding', ['name' => 'Negócio sintético '.$slug, 'slug' => $slug])->assertCreated()->json('data.id');

        return [$owner, Organization::findOrFail($id)];
    }

    private function context(User $user, Organization $organization): static
    {
        return $this->actingAs($user)->withSession(['organization_id' => $organization->id]);
    }

    public function test_member_list_includes_names_and_email_only_for_the_current_tenant_and_managers(): void
    {
        [$ownerA, $orgA] = $this->tenant('members-alpha');
        $employee = User::factory()->create(['name' => 'Pessoa sintética da equipe', 'email' => 'equipe@example.test']);
        Membership::create(['organization_id' => $orgA->id, 'user_id' => $employee->id, 'role' => 'employee', 'status' => 'active']);
        [$ownerB, $orgB] = $this->tenant('members-beta');
        $response = $this->context($ownerA, $orgA)->withHeader('X-Organization-Id', $orgB->id)->getJson('/api/v1/memberships')->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing([$ownerA->email, $employee->email], array_column($response->json('data'), 'email'));
        $this->assertNotContains($ownerB->email, array_column($response->json('data'), 'email'));
        $this->context($employee, $orgA)->getJson('/api/v1/memberships')->assertForbidden();
        $this->getJson('/api/v1/memberships/invitations')->assertForbidden();
    }

    public function test_invitation_metadata_never_exposes_secrets_and_duplicate_requests_are_idempotent(): void
    {
        [$owner, $org] = $this->tenant('invite-metadata');
        $this->context($owner, $org)->withHeader('Idempotency-Key', 'invitation-synthetic-0001');
        $input = ['email' => 'Convidado@example.test', 'role' => 'employee'];
        $created = $this->postJson('/api/v1/memberships/invitations', $input)->assertCreated()->assertJsonPath('data.delivery', 'manual');
        $id = $created->json('data.id');
        $token = $created->json('data.invitation_token');
        $this->assertSame(64, strlen($token));
        $this->postJson('/api/v1/memberships/invitations', $input)->assertOk()->assertJsonPath('data.id', $id)->assertJsonPath('data.invitation_token', null)->assertJsonPath('data.already_pending', true);
        $this->postJson('/api/v1/memberships/invitations', ['email' => 'outro@example.test', 'role' => 'employee'])->assertConflict();
        $this->assertDatabaseCount('membership_invitations', 1);
        $listed = $this->getJson('/api/v1/memberships/invitations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'pending')->assertJsonPath('data.0.email', 'convidado@example.test')
            ->assertJsonMissingPath('data.0.token_hash')->assertJsonMissingPath('data.0.request_hash')->assertJsonMissingPath('data.0.invitation_token');
        $this->assertStringNotContainsString($token, $listed->getContent());
        $this->assertDatabaseHas('membership_invitations', ['id' => $id, 'token_hash' => hash('sha256', $token)]);
    }

    public function test_pending_email_without_a_header_is_not_duplicated_and_role_change_is_explicit(): void
    {
        [$owner, $org] = $this->tenant('invite-natural');
        $this->context($owner, $org);
        $first = $this->postJson('/api/v1/memberships/invitations', ['email' => 'natural@example.test', 'role' => 'employee'])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/memberships/invitations', ['email' => 'NATURAL@example.test', 'role' => 'employee'])->assertOk()->assertJsonPath('data.id', $first)->assertJsonPath('data.invitation_token', null);
        $this->postJson('/api/v1/memberships/invitations', ['email' => 'natural@example.test', 'role' => 'admin'])->assertConflict();
        $this->assertDatabaseCount('membership_invitations', 1);
    }

    public function test_revoking_invitation_is_scoped_idempotent_and_blocks_acceptance(): void
    {
        [$ownerA, $orgA] = $this->tenant('revoke-alpha');
        $recipient = User::factory()->create(['email' => 'revoke-recipient@example.test']);
        $created = $this->context($ownerA, $orgA)->postJson('/api/v1/memberships/invitations', ['email' => $recipient->email, 'role' => 'employee'])->assertCreated();
        $id = $created->json('data.id');
        [$ownerB, $orgB] = $this->tenant('revoke-beta');
        $this->context($ownerB, $orgB)->deleteJson('/api/v1/memberships/invitations/'.$id)->assertNotFound();
        $this->context($ownerA, $orgA)->deleteJson('/api/v1/memberships/invitations/'.$id)->assertOk();
        $revokedAt = DB::table('membership_invitations')->where('id', $id)->value('revoked_at');
        $this->travel(1)->minutes();
        $this->deleteJson('/api/v1/memberships/invitations/'.$id)->assertOk();
        $this->assertSame($revokedAt, DB::table('membership_invitations')->where('id', $id)->value('revoked_at'));
        $this->assertSame(1, DB::table('audit_logs')->where('resource_id', $id)->where('action', 'membership.invitation_revoked')->count());
        $this->getJson('/api/v1/memberships/invitations')->assertOk()->assertJsonPath('data.0.status', 'revoked');
        $this->actingAs($recipient)->postJson('/api/v1/memberships/accept', ['token' => $created->json('data.invitation_token')])->assertNotFound();
        $this->assertDatabaseMissing('memberships', ['organization_id' => $orgA->id, 'user_id' => $recipient->id]);
    }

    public function test_expired_invitation_and_different_email_never_grant_access_but_valid_recipient_can_accept_once(): void
    {
        [$owner, $org] = $this->tenant('invite-accept');
        $recipient = User::factory()->create(['email' => 'accept-recipient@example.test']);
        $first = $this->context($owner, $org)->postJson('/api/v1/memberships/invitations', ['email' => $recipient->email, 'role' => 'employee'])->assertCreated();
        $this->actingAs(User::factory()->create())->postJson('/api/v1/memberships/accept', ['token' => $first->json('data.invitation_token')])->assertNotFound();
        $this->travel(4)->days();
        $this->actingAs($recipient)->postJson('/api/v1/memberships/accept', ['token' => $first->json('data.invitation_token')])->assertNotFound();
        $this->context($owner, $org)->getJson('/api/v1/memberships/invitations')->assertOk()->assertJsonPath('data.0.status', 'expired');
        $second = $this->postJson('/api/v1/memberships/invitations', ['email' => $recipient->email, 'role' => 'employee'])->assertCreated();
        $this->assertNotSame($first->json('data.id'), $second->json('data.id'));
        $token = $second->json('data.invitation_token');
        $this->actingAs($recipient)->postJson('/api/v1/memberships/accept', ['token' => $token, 'role' => 'owner'])->assertUnprocessable();
        $accepted = $this->postJson('/api/v1/memberships/accept', ['token' => $token])->assertOk()->assertJsonPath('data.role', 'employee')->json('data.id');
        $this->postJson('/api/v1/memberships/accept', ['token' => $token])->assertNotFound();
        $this->assertDatabaseHas('memberships', ['id' => $accepted, 'organization_id' => $org->id, 'role' => 'employee', 'status' => 'active']);
        $this->context($owner, $org)->deleteJson('/api/v1/memberships/invitations/'.$second->json('data.id'))->assertConflict();
        $this->getJson('/api/v1/memberships/invitations')->assertOk()->assertJsonPath('data.0.status', 'accepted');
    }

    public function test_employee_cannot_issue_invites_and_payload_cannot_promote_owner_or_choose_tenant(): void
    {
        [$owner, $org] = $this->tenant('invite-spoof');
        $employee = User::factory()->create();
        Membership::create(['organization_id' => $org->id, 'user_id' => $employee->id, 'role' => 'employee', 'status' => 'active']);
        $this->context($employee, $org)->postJson('/api/v1/memberships/invitations', ['email' => 'new@example.test', 'role' => 'admin'])->assertForbidden();
        $this->context($owner, $org)->postJson('/api/v1/memberships/invitations', ['email' => 'new@example.test', 'role' => 'owner'])->assertUnprocessable();
        $this->postJson('/api/v1/memberships/invitations', ['email' => 'new@example.test', 'role' => 'employee', 'organization_id' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('membership_invitations', 0);
    }

    public function test_organization_list_and_activation_are_limited_to_the_actors_active_memberships(): void
    {
        [$actor, $orgA] = $this->tenant('switch-alpha');
        [, $orgB] = $this->tenant('switch-beta');
        [, $orgC] = $this->tenant('switch-gamma');
        Membership::create(['organization_id' => $orgB->id, 'user_id' => $actor->id, 'role' => 'employee', 'status' => 'active']);
        Membership::create(['organization_id' => $orgC->id, 'user_id' => $actor->id, 'role' => 'employee', 'status' => 'revoked']);
        Service::forceCreate(['organization_id' => $orgA->id, 'name' => 'Serviço alpha', 'duration_minutes' => 30, 'price_cents' => 1000]);
        Service::forceCreate(['organization_id' => $orgB->id, 'name' => 'Serviço beta', 'duration_minutes' => 30, 'price_cents' => 1000]);
        $this->context($actor, $orgA)->withHeader('X-Organization-Id', $orgB->id);
        $listed = $this->getJson('/api/v1/organizations')->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing([$orgA->id, $orgB->id], array_column($listed->json('data'), 'id'));
        $this->getJson('/api/v1/services')->assertOk()->assertJsonPath('data.0.name', 'Serviço alpha');
        $this->postJson('/api/v1/organizations/activate', ['organization_id' => $orgB->id])->assertOk()->assertJsonPath('data.id', $orgB->id)->assertSessionHas('organization_id', $orgB->id);
        $this->getJson('/api/v1/auth/user')->assertOk()->assertJsonPath('data.organization.id', $orgB->id)->assertJsonPath('data.membership.role', 'employee');
        $this->getJson('/api/v1/services')->assertOk()->assertJsonPath('data.0.name', 'Serviço beta');
    }

    public function test_failed_activation_preserves_current_session_and_last_owner_protections(): void
    {
        [$actor, $orgA] = $this->tenant('deny-switch-alpha');
        [, $orgB] = $this->tenant('deny-switch-beta');
        $this->context($actor, $orgA)->postJson('/api/v1/organizations/activate', ['organization_id' => $orgB->id])->assertForbidden()->assertSessionHas('organization_id', $orgA->id);
        $this->postJson('/api/v1/organizations/activate', ['organization_id' => (string) Str::uuid()])->assertForbidden()->assertSessionHas('organization_id', $orgA->id);
        $this->postJson('/api/v1/organizations/activate', ['organization_id' => $orgA->id, 'role' => 'owner'])->assertUnprocessable()->assertSessionHas('organization_id', $orgA->id);
        $this->postJson('/api/v1/organizations/activate', ['organization_id' => 'invalid'])->assertUnprocessable()->assertSessionHas('organization_id', $orgA->id);
        $membership = Membership::where('organization_id', $orgA->id)->where('user_id', $actor->id)->firstOrFail();
        $this->deleteJson('/api/v1/memberships/'.$membership->id)->assertConflict();
        $this->assertDatabaseHas('memberships', ['id' => $membership->id, 'role' => 'owner', 'status' => 'active']);
    }

    public function test_professional_membership_link_is_tenant_scoped_unique_and_self_update_is_allowed(): void
    {
        [$owner, $orgA] = $this->tenant('professional-alpha');
        $member = Membership::create(['organization_id' => $orgA->id, 'user_id' => User::factory()->create()->id, 'role' => 'employee', 'status' => 'active']);
        DB::table('subscriptions')->where('organization_id', $orgA->id)->update(['plan_version_id' => app(BillingCatalog::class)->version('pro')->id]);
        [, $orgB] = $this->tenant('professional-beta');
        $foreign = Membership::where('organization_id', $orgB->id)->firstOrFail();
        $this->context($owner, $orgA);
        $id = $this->postJson('/api/v1/professionals', ['name' => 'Profissional com acesso', 'membership_id' => $member->id])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/professionals', ['name' => 'Link duplicado', 'membership_id' => $member->id])->assertUnprocessable()->assertJsonValidationErrors('membership_id');
        $this->patchJson('/api/v1/professionals/'.$id, ['name' => 'Nome atualizado', 'membership_id' => $member->id])->assertOk();
        $other = $this->postJson('/api/v1/professionals', ['name' => 'Profissional sem acesso'])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/professionals/'.$other, ['membership_id' => $member->id])->assertUnprocessable()->assertJsonValidationErrors('membership_id');
        $this->postJson('/api/v1/professionals', ['name' => 'Link de outro tenant', 'membership_id' => $foreign->id])->assertUnprocessable()->assertJsonValidationErrors('membership_id');
        $this->assertDatabaseCount('professionals', 2);
    }

    public function test_organization_switch_rate_limit_is_per_user_and_separate_from_onboarding(): void
    {
        [$actor, $organization] = $this->tenant('switch-rate-alpha');
        [$other, $otherOrganization] = $this->tenant('switch-rate-beta');
        $this->context($actor, $organization);
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $this->postJson('/api/v1/organizations/activate', ['organization_id' => $organization->id])->assertOk();
        }
        $this->postJson('/api/v1/organizations/activate', ['organization_id' => $organization->id])->assertStatus(429)->assertSessionHas('organization_id', $organization->id);
        $this->context($other, $otherOrganization)->postJson('/api/v1/organizations/activate', ['organization_id' => $otherOrganization->id])->assertOk();
    }

    public function test_invitation_acceptance_guesses_are_limited_per_authenticated_user(): void
    {
        $this->actingAs(User::factory()->create());
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->postJson('/api/v1/memberships/accept', ['token' => str_repeat('x', 64)])->assertNotFound();
        }
        $this->postJson('/api/v1/memberships/accept', ['token' => str_repeat('x', 64)])->assertStatus(429);
        $this->actingAs(User::factory()->create())->postJson('/api/v1/memberships/accept', ['token' => str_repeat('x', 64)])->assertNotFound();
        $this->assertDatabaseCount('memberships', 0);
    }
}
