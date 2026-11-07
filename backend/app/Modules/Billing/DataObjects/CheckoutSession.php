<?php

declare(strict_types=1);

namespace Modules\Billing\DataObjects;

/**
 * Resultado da criação de checkout: a URL para onde o navegador é redirecionado.
 */
final readonly class CheckoutSession
{
    public function __construct(
        public string $url,
        public ?string $gatewaySessionId = null,
    ) {}
}
