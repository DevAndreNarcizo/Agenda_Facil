<?php

declare(strict_types=1);

namespace Modules\Billing\Contracts;

use Modules\Billing\DataObjects\CheckoutRequest;
use Modules\Billing\DataObjects\CheckoutSession;
use Modules\Billing\DataObjects\WebhookEnvelope;

/**
 * Desacopla o Laravel do gateway de pagamento (Asaas como primeira opção, Stripe suportado).
 * A aplicação nunca conversa diretamente com o SDK de um provedor específico.
 */
interface BillingProvider
{
    /**
     * Nome do provedor (ex.: 'stripe', 'asaas'). Usado nas tabelas e no roteamento de webhooks.
     */
    public function name(): string;

    /**
     * Cria uma sessão de checkout para a assinatura de um plano.
     * O servidor resolve o preço/price_id — o navegador nunca envia valores.
     */
    public function createCheckoutSession(CheckoutRequest $request): CheckoutSession;

    /**
     * Verifica a assinatura/origem do webhook e devolve um envelope normalizado.
     * Lança exceção se a assinatura for inválida (proteção contra replay/forjamento).
     *
     * @param  string  $payload  corpo cru da requisição
     * @param  array<string, string>  $headers  cabeçalhos (assinatura do provedor)
     */
    public function parseWebhook(string $payload, array $headers): WebhookEnvelope;

    /**
     * Cancela a assinatura no gateway (imediatamente ou ao fim do período).
     */
    public function cancelSubscription(string $gatewaySubscriptionId, bool $atPeriodEnd): void;
}
