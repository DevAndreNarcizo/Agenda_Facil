<?php

declare(strict_types=1);

namespace Modules\Billing\Services;

use Illuminate\Support\Facades\Config;
use Modules\Billing\Contracts\BillingProvider;
use Modules\Billing\DataObjects\CheckoutRequest;
use Modules\Billing\DataObjects\CheckoutSession;
use Modules\Billing\Models\BillingCustomer;
use Modules\Billing\Models\Plan;
use Modules\Organizations\Models\Organization;
use RuntimeException;

/**
 * Orquestra o checkout: resolve plano/preço NO SERVIDOR, decide elegibilidade a trial sem
 * reiniciá-lo, cria/reaproveita a assinatura (sem duplicar) e delega ao BillingProvider.
 */
final class CheckoutService
{
    public function __construct(
        private readonly BillingProvider $provider,
        private readonly SubscriptionService $subscriptions,
    ) {}

    public function start(Organization $organization, string $planCode, string $customerEmail): CheckoutSession
    {
        $plan = Plan::query()->where('code', $planCode)->where('is_active', true)->first();

        if ($plan === null) {
            throw new RuntimeException('Plano indisponível.');
        }

        $version = $plan->currentVersion;

        if ($version === null) {
            throw new RuntimeException('Versão de plano indisponível.');
        }

        // Reaproveita/cria a assinatura viva em 'incomplete' (sem duplicar).
        $subscription = $this->subscriptions->startCheckout($organization, $version, $this->provider->name());

        // Trial só se a organização nunca o usou (não reinicia a cada checkout).
        $withTrial = ! $this->subscriptions->organizationHasEverTrialed($organization) && ! $subscription->trial_used;

        $gatewayCustomerId = BillingCustomer::query()
            ->where('organization_id', $organization->id)
            ->where('gateway', $this->provider->name())
            ->value('gateway_customer_id');

        $appUrl = Config::string('app.url');

        $request = new CheckoutRequest(
            organizationId: $organization->id,
            planCode: $plan->code,
            planVersionId: $version->id,
            gatewayPriceId: $version->gateway_price_id,
            priceCents: $version->price_cents,
            currency: $version->currency,
            customerEmail: $customerEmail,
            gatewayCustomerId: $gatewayCustomerId,
            withTrial: $withTrial,
            trialDays: SubscriptionService::DEFAULT_TRIAL_DAYS,
            successUrl: $appUrl.'/dashboard/subscription?checkout=success',
            cancelUrl: $appUrl.'/dashboard/subscription?checkout=cancelled',
        );

        return $this->provider->createCheckoutSession($request);
    }
}
