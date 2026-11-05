<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\DataObjects\WebhookEnvelope;
use Modules\Billing\Enums\SubscriptionStatus;
use Modules\Billing\Models\Plan;
use Modules\Billing\Models\Subscription;
use Modules\Billing\Services\SubscriptionService;
use Modules\Billing\Services\WebhookProcessor;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;

uses(RefreshDatabase::class);

/**
 * Prova idempotência e tolerância a eventos duplicados/fora de ordem (missão §9, AUDIT §5).
 */
beforeEach(function (): void {
    $this->seed(Database\Seeders\PlanCatalogSeeder::class);
    $this->processor = app(WebhookProcessor::class);
    $subscriptions = app(SubscriptionService::class);

    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona Teste', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Estúdio Teste', 'org_slug' => 'estudio-teste',
    ]);
    $this->organization = Organization::query()->where('owner_id', $user->id)->firstOrFail();
    $starter = Plan::query()->where('code', 'starter')->firstOrFail()->currentVersion;
    $this->subscription = $subscriptions->startCheckout($this->organization, $starter, 'fake');
    $this->subscription->update(['gateway_subscription_id' => 'fake_sub_1']);
});

function envelope(string $type, array $data = [], ?string $id = null): WebhookEnvelope
{
    return new WebhookEnvelope('fake', $id ?? (string) Str::uuid(), $type, $data);
}

it('ativa a assinatura apenas em payment.confirmed', function (): void {
    $this->processor->process(envelope('payment.confirmed', [
        'gateway_subscription_id' => 'fake_sub_1',
        'period_start' => now()->toIso8601String(),
        'period_end' => now()->addMonth()->toIso8601String(),
        'amount_cents' => 3900, 'gateway_invoice_id' => 'inv_1', 'gateway_payment_id' => 'pay_1',
    ], id: 'evt_pay_1'));

    expect($this->subscription->fresh()->status)->toBe(SubscriptionStatus::Active);
});

it('ignora evento duplicado (idempotência via ledger)', function (): void {
    $env = envelope('payment.confirmed', [
        'gateway_subscription_id' => 'fake_sub_1', 'amount_cents' => 3900,
        'gateway_invoice_id' => 'inv_1', 'gateway_payment_id' => 'pay_1',
    ], id: 'evt_dup');

    expect($this->processor->process($env))->toBe('processed')
        ->and($this->processor->process($env))->toBe('duplicate');

    // Não cria pagamentos duplicados.
    expect(Modules\Billing\Models\Payment::query()->count())->toBe(1);
});

it('tolera evento de falha de pagamento chegando depois — não derruba estado final indevidamente', function (): void {
    // Ativação.
    $this->processor->process(envelope('payment.confirmed', [
        'gateway_subscription_id' => 'fake_sub_1', 'amount_cents' => 3900,
        'gateway_invoice_id' => 'inv_1', 'gateway_payment_id' => 'pay_1',
    ], id: 'evt_a'));
    // Falha posterior.
    $this->processor->process(envelope('invoice.payment_failed', [
        'gateway_subscription_id' => 'fake_sub_1',
    ], id: 'evt_b'));

    expect($this->subscription->fresh()->status)->toBe(SubscriptionStatus::Grace)
        ->and($this->subscription->fresh()->grace_ends_at)->not->toBeNull();
});

it('cancela via webhook com status canônico', function (): void {
    $this->processor->process(envelope('subscription.canceled', [
        'gateway_subscription_id' => 'fake_sub_1',
    ], id: 'evt_cancel'));

    expect($this->subscription->fresh()->status)->toBe(SubscriptionStatus::Canceled);
});
