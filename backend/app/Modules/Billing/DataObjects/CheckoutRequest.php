<?php

declare(strict_types=1);

namespace Modules\Billing\DataObjects;

/**
 * Pedido de checkout montado pelo servidor. O navegador só informa o código do plano;
 * organização, preço e trial são resolvidos no backend.
 */
final readonly class CheckoutRequest
{
    public function __construct(
        public string $organizationId,
        public string $planCode,
        public string $planVersionId,
        public ?string $gatewayPriceId,
        public int $priceCents,
        public string $currency,
        public string $customerEmail,
        public ?string $gatewayCustomerId,
        public bool $withTrial,
        public int $trialDays,
        public string $successUrl,
        public string $cancelUrl,
    ) {}
}
