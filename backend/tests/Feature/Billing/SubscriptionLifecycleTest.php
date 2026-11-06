<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Enums\SubscriptionStatus;
use Modules\Billing\Models\Plan;
use Modules\Billing\Models\SubscriptionAuditLog;
use Modules\Billing\Services\SubscriptionService;
use Modules\Organizations\Models\Organization;

uses(RefreshDatabase::class);

/**
 * Prova que os defeitos de billing do AUDIT §5 estão corrigidos.
 * Monta a organização diretamente (sem o trial automático do provisionamento) para
 * exercitar as transições de assinatura a partir de um estado limpo.
 */
beforeEach(function (): void {
    $this->seed(PlanCatalogSeeder::class);
    $this->service = app(SubscriptionService::class);

    $user = User::factory()->create();
    $this->organization = Organization::create([
        'id' => (string) Str::uuid(),
        'name' => 'Estúdio Teste',
        'slug' => 'estudio-teste',
        'owner_id' => $user->id,
    ]);
    $this->starter = Plan::query()->where('code', 'starter')->firstOrFail()->currentVersion;
    $this->pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;
});

it('cria assinatura em incomplete no checkout — nunca active prematuramente', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');

    expect($subscription->status)->toBe(SubscriptionStatus::Incomplete)
        ->and($subscription->grantsPaidAccess())->toBeFalse();
});

it('só marca active mediante pagamento confirmado', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');

    $this->service->activateFromConfirmedPayment($subscription, now(), now()->addMonth());

    expect($subscription->fresh()->status)->toBe(SubscriptionStatus::Active);
});

it('não reinicia o trial em um segundo checkout', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');
    $this->service->beginTrial($subscription);
    $firstTrialEnd = $subscription->fresh()->trial_ends_at;

    // Segundo checkout (mesma organização) não deve criar nova assinatura nem novo trial.
    $second = $this->service->startCheckout($this->organization, $this->pro, 'fake');
    $this->service->beginTrial($second);

    expect($this->organization->subscriptions()->count())->toBe(1)
        ->and($second->fresh()->trial_ends_at?->toIso8601String())->toBe($firstTrialEnd?->toIso8601String())
        ->and($this->service->organizationHasEverTrialed($this->organization))->toBeTrue();
});

it('não cria assinatura duplicada — reaproveita a viva', function (): void {
    $first = $this->service->startCheckout($this->organization, $this->starter, 'fake');
    $second = $this->service->startCheckout($this->organization, $this->pro, 'fake');

    expect($second->id)->toBe($first->id)
        ->and($this->organization->subscriptions()->count())->toBe(1)
        ->and($second->plan_version_id)->toBe($this->pro->id);
});

it('percorre past_due, suspensão e reativação', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');
    $this->service->activateFromConfirmedPayment($subscription, now(), now()->addMonth());

    $this->service->markPastDue($subscription);
    expect($subscription->fresh()->status)->toBe(SubscriptionStatus::Grace)
        ->and($subscription->fresh()->grantsPaidAccess())->toBeTrue() // regularização ainda concede acesso
        ->and($subscription->fresh()->grace_ends_at)->not->toBeNull();

    $this->service->suspend($subscription);
    expect($subscription->fresh()->status)->toBe(SubscriptionStatus::Suspended)
        ->and($subscription->fresh()->grantsPaidAccess())->toBeFalse();

    $this->service->reactivate($subscription, now(), now()->addMonth());
    expect($subscription->fresh()->status)->toBe(SubscriptionStatus::Active);
});

it('suspende automaticamente quando o período de regularização expira', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');
    $this->service->activateFromConfirmedPayment($subscription, now(), now()->addMonth());
    $this->service->markPastDue($subscription);

    // Antes de expirar: nada é suspenso.
    expect($this->service->suspendExpiredGrace(now()))->toBe(0)
        ->and($subscription->fresh()->status)->toBe(SubscriptionStatus::Grace);

    // Após a janela de regularização: suspende.
    $suspended = $this->service->suspendExpiredGrace(now()->addDays(SubscriptionService::DEFAULT_GRACE_DAYS + 1));
    expect($suspended)->toBe(1)
        ->and($subscription->fresh()->status)->toBe(SubscriptionStatus::Suspended);
});

it('usa status canônico único (sem cancelled vs canceled)', function (): void {
    expect(SubscriptionStatus::fromGateway('cancelled'))->toBe(SubscriptionStatus::Canceled)
        ->and(SubscriptionStatus::fromGateway('canceled'))->toBe(SubscriptionStatus::Canceled);
});

it('faz upgrade e downgrade registrando auditoria', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');
    $this->service->activateFromConfirmedPayment($subscription, now(), now()->addMonth());

    $this->service->changePlan($subscription, $this->pro);
    expect($subscription->fresh()->plan_version_id)->toBe($this->pro->id);

    $this->service->changePlan($subscription, $this->starter);
    expect($subscription->fresh()->plan_version_id)->toBe($this->starter->id);

    $actions = $this->organization->subscriptions()->first()
        ->organization->id;
    expect(SubscriptionAuditLog::query()
        ->where('organization_id', $this->organization->id)
        ->whereIn('action', ['upgraded', 'downgraded'])->count())->toBe(2);
});

it('cancela imediatamente e ao fim do período', function (): void {
    $subscription = $this->service->startCheckout($this->organization, $this->starter, 'fake');
    $this->service->activateFromConfirmedPayment($subscription, now(), now()->addMonth());

    $this->service->cancel($subscription, atPeriodEnd: true);
    expect($subscription->fresh()->cancel_at_period_end)->toBeTrue()
        ->and($subscription->fresh()->status)->toBe(SubscriptionStatus::Active);

    $this->service->cancel($subscription, atPeriodEnd: false);
    expect($subscription->fresh()->status)->toBe(SubscriptionStatus::Canceled);
});
