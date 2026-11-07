<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\SubscriptionService;
use Modules\Customers\Models\Customer;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Professionals\Models\Professional;
use Modules\PublicBooking\Models\PublicBookingSettings;
use Modules\Services\Models\Service;

uses(RefreshDatabase::class);

/**
 * Fluxo de reserva pública por link + portal do cliente (OTP + sessão opaca),
 * preservando as garantias do sistema atual (SPEC-002/SPEC-007).
 */
function setupPublicOrg(string $slug, string $phone = '11999990000'): array
{
    $prov = app(ProvisioningService::class);
    $subs = app(SubscriptionService::class);
    $pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;

    $owner = $prov->registerOwner([
        'full_name' => 'Dona', 'email' => $slug.'@example.com', 'password' => 'senha12345',
        'org_name' => 'Org '.$slug, 'org_slug' => $slug,
    ]);
    $org = $owner->memberships()->firstOrFail()->organization;
    $subs->activateFromConfirmedPayment($subs->startCheckout($org, $pro, 'fake'), now(), now()->addMonth());

    PublicBookingSettings::create(['organization_id' => $org->id, 'is_enabled' => true]);

    $service = Service::create([
        'organization_id' => $org->id, 'name' => 'Corte', 'duration_minutes' => 60, 'price_cents' => 5000,
    ]);
    $professional = Professional::create([
        'organization_id' => $org->id, 'name' => 'Ana', 'is_active' => true,
    ]);
    $customer = Customer::create([
        'organization_id' => $org->id, 'name' => 'Cliente',
        'phone' => $phone, 'phone_normalized' => Customer::normalizePhone($phone),
    ]);

    return compact('org', 'service', 'professional', 'customer');
}

beforeEach(fn () => $this->seed(PlanCatalogSeeder::class));

it('expõe contexto público por slug quando habilitado', function (): void {
    $ctx = setupPublicOrg('studio-a');

    $this->getJson('/api/v1/public/studio-a/context')
        ->assertOk()
        ->assertJsonPath('data.organization.slug', 'studio-a')
        ->assertJsonCount(1, 'data.services')
        ->assertJsonCount(1, 'data.professionals');
});

it('retorna 404 para slug inexistente ou reservas desabilitadas', function (): void {
    $this->getJson('/api/v1/public/nao-existe/context')->assertStatus(404);
});

it('resposta de OTP é genérica mesmo para telefone inexistente (anti-enumeração)', function (): void {
    setupPublicOrg('studio-b', '11988887777');

    $known = $this->postJson('/api/v1/public/studio-b/portal/otp/request', ['phone' => '11988887777'])->assertStatus(202);
    $unknown = $this->postJson('/api/v1/public/studio-b/portal/otp/request', ['phone' => '11900000000'])->assertStatus(202);

    // Mesma mensagem genérica; só o telefone conhecido recebe código (debug em teste).
    expect($known->json('message'))->toBe($unknown->json('message'))
        ->and($known->json('debug_code'))->not->toBeNull()
        ->and($unknown->json('debug_code'))->toBeNull();
});

it('completa OTP -> sessão opaca -> reserva pública', function (): void {
    ['service' => $service, 'professional' => $professional] = setupPublicOrg('studio-c', '11977776666');

    $code = $this->postJson('/api/v1/public/studio-c/portal/otp/request', ['phone' => '11977776666'])
        ->assertStatus(202)->json('debug_code');

    $token = $this->postJson('/api/v1/public/studio-c/portal/otp/verify', [
        'phone' => '11977776666', 'code' => $code,
    ])->assertOk()->json('token');

    expect($token)->toMatch('/^[a-f0-9]{64}$/');

    $this->postJson('/api/v1/public/studio-c/portal/booking', [
        'service_id' => $service->id,
        'professional_id' => $professional->id,
        'start_time' => '2026-12-10T09:00:00-03:00',
    ], ['X-Portal-Session' => $token])->assertCreated()->assertJsonPath('data.status', 'pending');
});

it('rejeita reserva pública sem sessão de portal válida', function (): void {
    ['service' => $service, 'professional' => $professional] = setupPublicOrg('studio-d');

    $this->postJson('/api/v1/public/studio-d/portal/booking', [
        'service_id' => $service->id,
        'professional_id' => $professional->id,
        'start_time' => '2026-12-10T09:00:00-03:00',
    ], ['X-Portal-Session' => str_repeat('a', 64)])->assertStatus(401);
});

it('rejeita OTP inválido', function (): void {
    setupPublicOrg('studio-e', '11966665555');
    $this->postJson('/api/v1/public/studio-e/portal/otp/request', ['phone' => '11966665555'])->assertStatus(202);

    $this->postJson('/api/v1/public/studio-e/portal/otp/verify', [
        'phone' => '11966665555', 'code' => '000000',
    ])->assertStatus(422);
});

it('impede usar sessão de portal de uma org em outra (isolamento)', function (): void {
    ['service' => $serviceC] = setupPublicOrg('studio-f', '11955554444');
    setupPublicOrg('studio-g', '11955554444'); // outra org, mesmo telefone

    $code = $this->postJson('/api/v1/public/studio-f/portal/otp/request', ['phone' => '11955554444'])->json('debug_code');
    $token = $this->postJson('/api/v1/public/studio-f/portal/otp/verify', ['phone' => '11955554444', 'code' => $code])->json('token');

    // Token de studio-f usado em studio-g -> sessão inválida (organização diferente).
    $prof = Professional::where('organization_id',
        Organization::where('slug', 'studio-g')->value('id'))->first();
    $svc = Service::where('organization_id',
        Organization::where('slug', 'studio-g')->value('id'))->first();

    $this->postJson('/api/v1/public/studio-g/portal/booking', [
        'service_id' => $svc->id,
        'professional_id' => $prof->id,
        'start_time' => '2026-12-10T09:00:00-03:00',
    ], ['X-Portal-Session' => $token])->assertStatus(401);
});
