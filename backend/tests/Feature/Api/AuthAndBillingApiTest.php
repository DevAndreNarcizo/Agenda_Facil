<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Prova o fluxo pela API HTTP: cadastro -> plano no servidor -> checkout -> webhook -> ativação.
 */
beforeEach(function (): void {
    $this->seed(Database\Seeders\PlanCatalogSeeder::class);
    config()->set('billing.provider', 'fake');
});

it('expõe o catálogo de planos pela API (fonte no servidor)', function (): void {
    $response = $this->getJson('/api/v1/plans');

    $response->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.code', 'starter')
        ->assertJsonPath('data.0.price_cents', 3900);
});

it('cadastra dono e retorna token', function (): void {
    $response = $this->postJson('/api/v1/auth/register', [
        'full_name' => 'Dona Teste',
        'email' => 'dona@example.com',
        'password' => 'senha12345',
        'org_name' => 'Estúdio Teste',
        'org_slug' => 'estudio-teste',
    ]);

    $response->assertCreated()
        ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);
});

it('inicia checkout apenas para o owner autenticado', function (): void {
    $this->postJson('/api/v1/auth/register', [
        'full_name' => 'Dona Teste', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Estúdio Teste', 'org_slug' => 'estudio-teste',
    ])->assertCreated();

    $token = \App\Models\User::query()->where('email', 'dona@example.com')->first()->createToken('t')->plainTextToken;

    $response = $this->withToken($token)->postJson('/api/v1/subscription/checkout', [
        'plan_code' => 'pro',
    ]);

    $response->assertOk()->assertJsonStructure(['url']);
});

it('rejeita checkout sem autenticação', function (): void {
    $this->postJson('/api/v1/subscription/checkout', ['plan_code' => 'pro'])
        ->assertUnauthorized();
});

it('processa webhook assinado e ativa a assinatura', function (): void {
    // Cadastra e inicia checkout (cria assinatura incomplete).
    $this->postJson('/api/v1/auth/register', [
        'full_name' => 'Dona Teste', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Estúdio Teste', 'org_slug' => 'estudio-teste',
    ])->assertCreated();

    $user = \App\Models\User::query()->where('email', 'dona@example.com')->first();
    $token = $user->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/v1/subscription/checkout', ['plan_code' => 'starter'])->assertOk();

    $organization = \Modules\Organizations\Models\Organization::query()->where('owner_id', $user->id)->first();

    // Monta um webhook fake assinado.
    $payload = json_encode([
        'id' => 'evt_http_1',
        'type' => 'payment.confirmed',
        'data' => [
            'organization_id' => $organization->id,
            'amount_cents' => 3900,
            'gateway_invoice_id' => 'inv_http_1',
            'gateway_payment_id' => 'pay_http_1',
        ],
    ], JSON_THROW_ON_ERROR);
    $signature = hash_hmac('sha256', $payload, (string) config('billing.fake_webhook_secret'));

    $response = $this->call(
        'POST',
        '/api/v1/billing/webhook/fake',
        [], [], [],
        ['CONTENT_TYPE' => 'application/json', 'HTTP_X_FAKE_SIGNATURE' => $signature],
        $payload,
    );

    $response->assertOk()->assertJsonPath('result', 'processed');
    expect($organization->fresh()->liveSubscription->status->value)->toBe('active');
});

it('rejeita webhook com assinatura inválida', function (): void {
    $payload = json_encode(['id' => 'x', 'type' => 'payment.confirmed', 'data' => []], JSON_THROW_ON_ERROR);

    $this->call('POST', '/api/v1/billing/webhook/fake', [], [], [],
        ['CONTENT_TYPE' => 'application/json', 'HTTP_X_FAKE_SIGNATURE' => 'wrong'],
        $payload,
    )->assertStatus(400);
});
