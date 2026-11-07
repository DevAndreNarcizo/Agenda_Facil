<?php

declare(strict_types=1);

namespace Modules\Billing\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Billing\DataObjects\WebhookEnvelope;
use Modules\Billing\Models\Invoice;
use Modules\Billing\Models\Payment;
use Modules\Billing\Models\Subscription;
use Modules\Billing\Models\WebhookEvent;

/**
 * Processa webhooks de pagamento com idempotência e tolerância a eventos duplicados/fora de ordem.
 *
 * Corrige os defeitos do AUDIT §5:
 *  - 'active' só em pagamento confirmado (payment.confirmed / invoice.paid), nunca no checkout.
 *  - eventos duplicados são ignorados via ledger (unique provider+event_id).
 *  - status mapeado para o enum canônico (sem cancelled/canceled divergente).
 */
final class WebhookProcessor
{
    public function __construct(private readonly SubscriptionService $subscriptions) {}

    /**
     * @return string 'processed' | 'duplicate'
     */
    public function process(WebhookEnvelope $envelope): string
    {
        // Idempotência: tenta reservar o evento. Se já existe, é duplicado.
        /** @var WebhookEvent|null $existing */
        $existing = WebhookEvent::query()
            ->where('provider', $envelope->provider)
            ->where('provider_event_id', $envelope->eventId)
            ->first();

        if ($existing && $existing->status === 'processed') {
            return 'duplicate';
        }

        $event = $existing ?? WebhookEvent::create([
            'provider' => $envelope->provider,
            'provider_event_id' => $envelope->eventId,
            'event_type' => $envelope->type,
            'status' => 'processing',
            'payload' => $envelope->data,
        ]);

        try {
            $this->dispatch($envelope);

            $event->update(['status' => 'processed', 'processed_at' => now(), 'error_code' => null]);

            return 'processed';
        } catch (\Throwable $e) {
            $event->update(['status' => 'failed', 'error_code' => substr($e->getMessage(), 0, 190)]);
            throw $e;
        }
    }

    private function dispatch(WebhookEnvelope $envelope): void
    {
        match ($envelope->type) {
            'subscription.trial_started' => $this->onTrialStarted($envelope),
            'payment.confirmed', 'invoice.paid' => $this->onPaymentConfirmed($envelope),
            'invoice.payment_failed' => $this->onPaymentFailed($envelope),
            'subscription.canceled' => $this->onCanceled($envelope),
            default => null, // eventos não tratados são apenas registrados (idempotentes)
        };
    }

    private function resolveSubscription(WebhookEnvelope $envelope): ?Subscription
    {
        $gatewaySubId = $envelope->get('gateway_subscription_id');
        $organizationId = $envelope->get('organization_id');

        $query = Subscription::query();

        if (is_string($gatewaySubId) && $gatewaySubId !== '') {
            $found = (clone $query)->where('gateway_subscription_id', $gatewaySubId)->first();
            if ($found) {
                return $found;
            }
        }

        if (is_string($organizationId) && $organizationId !== '') {
            return $query->where('organization_id', $organizationId)
                ->whereNot('status', 'canceled')
                ->latest()
                ->first();
        }

        return null;
    }

    private function onTrialStarted(WebhookEnvelope $envelope): void
    {
        $subscription = $this->resolveSubscription($envelope);
        if ($subscription === null) {
            return;
        }

        // Vincula o id do gateway quando presente (primeira notificação).
        $this->bindGatewayId($subscription, $envelope);
        $this->subscriptions->beginTrial($subscription, SubscriptionService::DEFAULT_TRIAL_DAYS);
    }

    private function onPaymentConfirmed(WebhookEnvelope $envelope): void
    {
        $subscription = $this->resolveSubscription($envelope);
        if ($subscription === null) {
            return;
        }

        $this->bindGatewayId($subscription, $envelope);

        $periodStart = $this->date($envelope->get('period_start')) ?? Carbon::now();
        $periodEnd = $this->date($envelope->get('period_end')) ?? Carbon::now()->addMonth();

        // Registra invoice/payment confirmados (tabelas de registro).
        $this->recordPaidInvoice($subscription, $envelope);

        // Renovação se já era ativa; senão ativação inicial. Reativa se suspensa/em regularização.
        if (in_array($subscription->status->value, ['suspended', 'grace'], true)) {
            $this->subscriptions->reactivate($subscription, $periodStart, $periodEnd);
        } elseif ($subscription->status->value === 'active') {
            $this->subscriptions->renew($subscription, $periodStart, $periodEnd);
        } else {
            $this->subscriptions->activateFromConfirmedPayment($subscription, $periodStart, $periodEnd);
        }
    }

    private function onPaymentFailed(WebhookEnvelope $envelope): void
    {
        $subscription = $this->resolveSubscription($envelope);
        if ($subscription === null) {
            return;
        }

        $this->subscriptions->markPastDue($subscription);
    }

    private function onCanceled(WebhookEnvelope $envelope): void
    {
        $subscription = $this->resolveSubscription($envelope);
        if ($subscription === null) {
            return;
        }

        $this->subscriptions->cancel($subscription, atPeriodEnd: false);
    }

    private function bindGatewayId(Subscription $subscription, WebhookEnvelope $envelope): void
    {
        $gatewaySubId = $envelope->get('gateway_subscription_id');
        if (is_string($gatewaySubId) && $gatewaySubId !== '' && $subscription->gateway_subscription_id === null) {
            $subscription->gateway_subscription_id = $gatewaySubId;
            $subscription->save();
        }
    }

    private function recordPaidInvoice(Subscription $subscription, WebhookEnvelope $envelope): void
    {
        $gatewayInvoiceId = $envelope->get('gateway_invoice_id');
        $amount = (int) ($envelope->get('amount_cents') ?? 0);

        DB::transaction(function () use ($subscription, $envelope, $gatewayInvoiceId, $amount): void {
            $invoice = Invoice::query()->updateOrCreate(
                ['gateway' => $subscription->gateway, 'gateway_invoice_id' => $gatewayInvoiceId],
                [
                    'organization_id' => $subscription->organization_id,
                    'subscription_id' => $subscription->id,
                    'status' => 'paid',
                    'amount_cents' => $amount,
                    'currency' => (string) ($envelope->get('currency') ?? 'BRL'),
                    'issued_at' => now(),
                    'paid_at' => now(),
                ],
            );

            Payment::query()->updateOrCreate(
                ['gateway' => $subscription->gateway, 'gateway_payment_id' => $envelope->get('gateway_payment_id')],
                [
                    'invoice_id' => $invoice->id,
                    'organization_id' => $subscription->organization_id,
                    'method' => (string) ($envelope->get('method') ?? 'card'),
                    'status' => 'confirmed',
                    'amount_cents' => $amount,
                    'currency' => (string) ($envelope->get('currency') ?? 'BRL'),
                    'confirmed_at' => now(),
                ],
            );
        });
    }

    private function date(mixed $value): ?Carbon
    {
        if (is_string($value) && $value !== '') {
            return Carbon::parse($value);
        }

        return null;
    }
}
