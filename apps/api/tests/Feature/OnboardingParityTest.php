<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Organizations\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class OnboardingParityTest extends TestCase
{
    use RefreshDatabase;

    private function payload(string $slug = 'onboarding-parity'): array
    {
        return [
            'name' => 'Negócio sintético', 'slug' => $slug, 'timezone' => 'America/Sao_Paulo',
            'profile' => ['specialty' => 'Especialidade sintética', 'instagram' => '@perfil_sintetico', 'bio' => 'Descrição sintética do negócio.'],
            'address' => ['postal_code' => '00000-000', 'street' => 'Rua sintética', 'number' => '10', 'city' => 'Cidade sintética', 'state' => 'GO'],
            'initial_service' => ['name' => 'Atendimento sintético', 'duration_minutes' => 45, 'price_cents' => 7500, 'category' => 'Categoria sintética'],
            'business_hours' => array_map(fn (int $day): array => ['day_of_week' => $day, 'start_time' => '08:00', 'end_time' => $day === 0 || $day === 6 ? '13:00' : '18:00', 'is_active' => $day >= 1 && $day <= 5], range(0, 6)),
        ];
    }

    public function test_six_step_payload_is_atomic_and_repeating_it_never_duplicates_or_overwrites(): void
    {
        $owner = User::factory()->create();
        $payload = $this->payload();
        $response = $this->actingAs($owner)->postJson('/api/v1/onboarding', $payload)->assertCreated()
            ->assertJsonPath('data.settings.specialty', $payload['profile']['specialty'])
            ->assertJsonPath('data.settings.instagram', $payload['profile']['instagram'])
            ->assertJsonPath('data.settings.bio', $payload['profile']['bio'])
            ->assertJsonPath('data.settings.address.street', $payload['address']['street'])
            ->assertJsonMissingPath('data.settings.profile');
        $id = $response->json('data.id');
        $this->assertDatabaseHas('organizations', ['id' => $id, 'owner_id' => $owner->id]);
        $this->assertDatabaseHas('memberships', ['organization_id' => $id, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);
        $this->assertDatabaseHas('services', ['organization_id' => $id, ...$payload['initial_service']]);
        $this->assertDatabaseHas('business_hours', ['organization_id' => $id, 'day_of_week' => 1, 'start_time' => '08:00', 'end_time' => '18:00', 'is_active' => true]);
        $this->postJson('/api/v1/onboarding', [...$payload, 'name' => 'Não deve substituir', 'initial_service' => [...$payload['initial_service'], 'name' => 'Outro serviço'], 'profile' => ['bio' => 'Não deve substituir']])->assertCreated()->assertJsonPath('data.id', $id)->assertJsonPath('data.name', 'Negócio sintético');
        foreach (['organizations' => 1, 'memberships' => 1, 'services' => 1, 'business_hours' => 7, 'subscriptions' => 1] as $table => $count) {
            $this->assertDatabaseCount($table, $count);
        }
        $this->assertSame($payload['profile']['bio'], Organization::findOrFail($id)->settings['bio']);
    }

    public function test_original_three_field_client_keeps_default_hours_and_does_not_create_a_service(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', ['name' => 'Cliente legado sintético', 'slug' => 'legacy-onboarding'])->assertCreated();
        $this->assertDatabaseCount('business_hours', 7);
        $this->assertDatabaseCount('services', 0);
        $this->assertDatabaseHas('business_hours', ['day_of_week' => 1, 'start_time' => '09:00', 'end_time' => '18:00', 'is_active' => true]);
        $this->assertDatabaseHas('business_hours', ['day_of_week' => 0, 'is_active' => false]);
    }

    public function test_privileged_fields_and_unknown_nested_fields_are_rejected_before_any_provisioning(): void
    {
        $this->actingAs(User::factory()->create());
        foreach (['organization_id' => (string) Str::uuid(), 'owner_id' => (string) Str::uuid(), 'role' => 'owner', 'subscription_status' => 'active', 'settings' => ['plan' => 'clinic'], 'logo_file_id' => (string) Str::uuid()] as $field => $value) {
            $this->postJson('/api/v1/onboarding', [...$this->payload(), $field => $value])->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        foreach (['profile' => ['role' => 'owner'], 'address' => ['organization_id' => (string) Str::uuid()], 'initial_service' => ['organization_id' => (string) Str::uuid()]] as $field => $extra) {
            $payload = $this->payload();
            $payload[$field] = [...$payload[$field], ...$extra];
            $this->postJson('/api/v1/onboarding', $payload)->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('organizations', 0);
        $this->assertDatabaseCount('services', 0);
        $this->assertDatabaseCount('subscriptions', 0);
    }

    public function test_invalid_hours_and_service_never_leave_a_partial_organization(): void
    {
        $this->actingAs(User::factory()->create());
        $payload = $this->payload();
        $payload['business_hours'][1]['end_time'] = '07:00';
        $this->postJson('/api/v1/onboarding', $payload)->assertUnprocessable()->assertJsonValidationErrors('business_hours.1.end_time');
        $payload = $this->payload();
        $payload['business_hours'][1]['day_of_week'] = 0;
        $this->postJson('/api/v1/onboarding', $payload)->assertUnprocessable();
        $payload = $this->payload();
        $payload['initial_service']['duration_minutes'] = 4;
        $this->postJson('/api/v1/onboarding', $payload)->assertUnprocessable()->assertJsonValidationErrors('initial_service.duration_minutes');
        foreach (['organizations', 'memberships', 'services', 'business_hours', 'subscriptions'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_database_failure_in_initial_service_rolls_back_the_whole_provisioning(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION pg_temp.reject_onboarding_service() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'synthetic onboarding service failure'; END $$;
            CREATE TRIGGER synthetic_reject_onboarding_service BEFORE INSERT ON services
            FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_onboarding_service();
            SQL);
        $response = $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', $this->payload())->assertStatus(500);
        $response->assertSessionMissing('organization_id');
        foreach (['organizations', 'memberships', 'services', 'business_hours', 'subscriptions', 'audit_logs'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_slug_collision_preserves_the_first_tenant_without_partial_second_tenant(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', $this->payload())->assertCreated();
        $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', $this->payload())->assertUnprocessable()->assertJsonValidationErrors('slug');
        foreach (['organizations' => 1, 'memberships' => 1, 'services' => 1, 'business_hours' => 7, 'subscriptions' => 1] as $table => $count) {
            $this->assertDatabaseCount($table, $count);
        }
    }

    public function test_settings_patch_uses_the_same_allowlist_and_preserves_unmodified_fields(): void
    {
        $payload = $this->payload();
        $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', $payload)->assertCreated();
        $this->patchJson('/api/v1/settings', ['profile' => ['bio' => 'Biografia sintética atualizada'], 'address' => ['city' => 'Outra cidade sintética']])->assertOk()
            ->assertJsonPath('data.settings.bio', 'Biografia sintética atualizada')
            ->assertJsonPath('data.settings.specialty', $payload['profile']['specialty'])
            ->assertJsonPath('data.settings.address.city', 'Outra cidade sintética')
            ->assertJsonPath('data.settings.address.street', $payload['address']['street']);
        $this->patchJson('/api/v1/settings', ['profile' => ['role' => 'owner']])->assertUnprocessable();
        $this->patchJson('/api/v1/settings', ['settings' => ['specialty' => 'Ataque']])->assertUnprocessable();
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonCount(7, 'data.business_hours')->assertJsonPath('data.settings.specialty', $payload['profile']['specialty']);
    }

    public function test_category_is_nullable_for_old_clients_and_supported_in_authorized_service_crud(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', ['name' => 'Negócio sintético', 'slug' => 'category-parity'])->assertCreated();
        $id = $this->postJson('/api/v1/services', ['name' => 'Serviço legado', 'duration_minutes' => 30, 'price_cents' => 5000])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/services/'.$id, ['category' => 'Categoria sintética'])->assertOk()->assertJsonPath('data.category', 'Categoria sintética');
        $this->patchJson('/api/v1/services/'.$id, ['category' => str_repeat('x', 81)])->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->patchJson('/api/v1/services/'.$id, ['category' => null])->assertOk()->assertJsonPath('data.category', null);
        $this->patchJson('/api/v1/services/'.$id, ['category' => 'Categoria', 'organization_id' => (string) Str::uuid()])->assertUnprocessable();
    }

    public function test_onboarding_retry_limit_is_per_user_and_preserves_idempotent_provisioning(): void
    {
        $this->actingAs(User::factory()->create());
        $payload = ['name' => 'Negócio sintético', 'slug' => 'retry-limit'];
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->postJson('/api/v1/onboarding', $payload)->assertCreated();
        }
        $this->postJson('/api/v1/onboarding', $payload)->assertStatus(429);
        $this->assertDatabaseCount('organizations', 1);
        $this->assertDatabaseCount('memberships', 1);
        $this->assertDatabaseCount('subscriptions', 1);
        $this->actingAs(User::factory()->create())->postJson('/api/v1/onboarding', ['name' => 'Outro negócio sintético', 'slug' => 'retry-other-user'])->assertCreated();
        $this->assertDatabaseCount('organizations', 2);
    }
}
