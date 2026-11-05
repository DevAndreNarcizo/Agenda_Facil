<?php

declare(strict_types=1);

namespace Modules\Billing\Providers;

use Illuminate\Support\Str;
use Modules\Billing\Contracts\BillingProvider;
use Modules\Billing\DataObjects\CheckoutRequest;
use Modules\Billing\DataObjects\CheckoutSession;
use Modules\Billing\DataObjects\WebhookEnvelope;
use RuntimeException;

/**
 * Provedor sintético para desenvolvimento e testes (sem dependência externa).
 * Simula o contrato do BillingProvider de forma determinística. NÃO usar em produção.
 *
 * Mantém a aplicação testável ponta a ponta enquanto a homologação de Stripe/Asaas está
 * bloqueada por credenciais (ver AUDIT §Bloqueios).
 */
final class FakeBillingProvider implements BillingProvider
{
    public function name(): string
    {
        return 'fake';
    }

    public function createCheckoutSession(CheckoutRequest $request): CheckoutSession
    {
        $sessionId = 'fake_cs_'.Str::random(16);

        return new CheckoutSession(
            url: $request->successUrl.'&session_id='.$sessionId,
            gatewaySessionId: $sessionId,
        );
    }

    /**
     * No fake, o "payload" já é um JSON normalizado assinado por um segredo compartilhado simples.
     *
     * @param  array<string, string>  $headers
     */
    public function parseWebhook(string $payload, array $headers): WebhookEnvelope
    {
        $signature = $headers['x-fake-signature'] ?? $headers['X-Fake-Signature'] ?? null;
        $secret = (string) config('billing.fake_webhook_secret', 'fake-secret');

        if (! is_string($signature) || ! hash_equals(hash_hmac('sha256', $payload, $secret), $signature)) {
            throw new RuntimeException('Assinatura de webhook inválida.');
        }

        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($payload, true, flags: JSON_THROW_ON_ERROR);

        return new WebhookEnvelope(
            provider: 'fake',
            eventId: (string) ($decoded['id'] ?? Str::uuid()),
            type: (string) ($decoded['type'] ?? 'unknown'),
            data: (array) ($decoded['data'] ?? []),
        );
    }

    public function cancelSubscription(string $gatewaySubscriptionId, bool $atPeriodEnd): void
    {
        // no-op no fake
    }
}
