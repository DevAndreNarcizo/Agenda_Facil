<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\SubscriptionService;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Scheduling\Models\Appointment;

uses(RefreshDatabase::class);

/**
 * Fluxo operacional ponta a ponta pela API HTTP, com tenant resolvido no servidor,
 * guard de assinatura e isolamento entre organizações.
 */
function ownerToken(string $email, string $slug): array
{
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => $email, 'password' => 'senha12345',
        'org_name' => 'Org '.$slug, 'org_slug' => $slug,
    ]);
    // Usa a organização do membership (fonte de verdade do tenant) para evitar ambiguidade.
    $organization = $user->memberships()->with('organization')->first()->organization;

    // Ativa assinatura Pro (acesso pago liberado).
    $subs = app(SubscriptionService::class);
    $pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;
    $sub = $subs->startCheckout($organization, $pro, 'fake');
    $subs->activateFromConfirmedPayment($sub, now(), now()->addMonth());

    return [$user->createToken('t')->plainTextToken, $organization];
}

beforeEach(fn () => $this->seed(PlanCatalogSeeder::class));

it('cria serviço, profissional, cliente e agendamento pela API', function (): void {
    [$token, $org] = ownerToken('dona@example.com', 'studio');
    $h = ['X-Organization-Id' => $org->id];

    $this->withToken($token)->postJson('/api/v1/services', [
        'name' => 'Corte', 'duration_minutes' => 60, 'price_cents' => 5000,
    ], $h)->assertCreated();

    $prof = $this->withToken($token)->postJson('/api/v1/professionals', ['name' => 'Ana'], $h)
        ->assertCreated()->json('data.id');

    $customer = $this->withToken($token)->postJson('/api/v1/customers', [
        'name' => 'Cliente Teste', 'phone' => '(11) 99999-0000',
    ], $h)->assertCreated()->json('data.id');

    $this->withToken($token)->postJson('/api/v1/appointments', [
        'professional_id' => $prof,
        'customer_id' => $customer,
        'start_time' => '2026-12-01T09:00:00-03:00',
        'end_time' => '2026-12-01T10:00:00-03:00',
    ], $h)->assertCreated()->assertJsonPath('data.status', 'pending');
});

it('retorna 409 ao agendar horário sobreposto pela API', function (): void {
    [$token, $org] = ownerToken('dona@example.com', 'studio');
    $h = ['X-Organization-Id' => $org->id];

    $prof = $this->withToken($token)->postJson('/api/v1/professionals', ['name' => 'Ana'], $h)->json('data.id');

    $this->withToken($token)->postJson('/api/v1/appointments', [
        'professional_id' => $prof,
        'start_time' => '2026-12-01T09:00:00-03:00',
        'end_time' => '2026-12-01T10:00:00-03:00',
    ], $h)->assertCreated();

    $this->withToken($token)->postJson('/api/v1/appointments', [
        'professional_id' => $prof,
        'start_time' => '2026-12-01T09:30:00-03:00',
        'end_time' => '2026-12-01T10:30:00-03:00',
    ], $h)->assertStatus(409);
});

it('impede acesso a agendamento de outra organização (anti-IDOR)', function (): void {
    // Dois donos/organizações distintos, capturando a org a partir do membership (fonte de verdade).
    $provision = app(ProvisioningService::class);
    $subs = app(SubscriptionService::class);
    $pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;

    $userA = $provision->registerOwner([
        'full_name' => 'A', 'email' => 'a@example.com', 'password' => 'senha12345',
        'org_name' => 'Org A', 'org_slug' => 'org-a',
    ]);
    $orgA = $userA->memberships()->firstOrFail()->organization;
    $subs->activateFromConfirmedPayment($subs->startCheckout($orgA, $pro, 'fake'), now(), now()->addMonth());

    $userB = $provision->registerOwner([
        'full_name' => 'B', 'email' => 'b@example.com', 'password' => 'senha12345',
        'org_name' => 'Org B', 'org_slug' => 'org-b',
    ]);
    $orgB = $userB->memberships()->firstOrFail()->organization;
    $subs->activateFromConfirmedPayment($subs->startCheckout($orgB, $pro, 'fake'), now(), now()->addMonth());

    expect($userA->id)->not->toBe($userB->id)
        ->and($orgA->id)->not->toBe($orgB->id);

    // A cria um agendamento na sua organização (autenticado como A).
    Sanctum::actingAs($userA, ['*']);
    $profA = $this->postJson('/api/v1/professionals', ['name' => 'Ana'], ['X-Organization-Id' => $orgA->id])
        ->assertCreated()->json('data.id');
    $apptA = $this->postJson('/api/v1/appointments', [
        'professional_id' => $profA,
        'start_time' => '2026-12-01T09:00:00-03:00',
        'end_time' => '2026-12-01T10:00:00-03:00',
    ], ['X-Organization-Id' => $orgA->id])->assertCreated()->json('data.id');

    // Agora autenticado como B: NUNCA consegue agir sobre o agendamento de A.
    Sanctum::actingAs($userB, ['*']);

    // No contexto da própria organização de B, o recurso não existe -> 404.
    $this->postJson("/api/v1/appointments/{$apptA}/status", [
        'status' => 'cancelled',
    ], ['X-Organization-Id' => $orgB->id])->assertNotFound();

    // Forjando o contexto para a org de A, o middleware de tenant barra -> 403.
    $this->postJson("/api/v1/appointments/{$apptA}/status", [
        'status' => 'cancelled',
    ], ['X-Organization-Id' => $orgA->id])->assertForbidden();

    // Propriedade essencial: o agendamento de A permanece intacto.
    expect(
        Appointment::query()->whereKey($apptA)->value('status')
    )->not->toBe('cancelled');
});

it('bloqueia operações pagas quando a assinatura não concede acesso (402)', function (): void {
    // Cadastra dono sem ativar assinatura (fica incomplete -> sem acesso pago).
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'semplano@example.com', 'password' => 'senha12345',
        'org_name' => 'Org Sem Plano', 'org_slug' => 'sem-plano',
    ]);
    $org = Organization::query()->where('owner_id', $user->id)->firstOrFail();
    $subs = app(SubscriptionService::class);
    $starter = Plan::query()->where('code', 'starter')->firstOrFail()->currentVersion;
    $subs->startCheckout($org, $starter, 'fake'); // incomplete, não ativa

    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->getJson('/api/v1/services', ['X-Organization-Id' => $org->id])
        ->assertStatus(402);
});
