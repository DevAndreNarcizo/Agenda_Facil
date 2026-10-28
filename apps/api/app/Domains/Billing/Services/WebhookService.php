<?php

declare(strict_types=1);

namespace App\Domains\Billing\Services;

use App\Domains\Billing\Contracts\BillingProvider;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class WebhookService
{
    public function __construct(private readonly BillingProvider $provider) {}

    /** Ledger sem payload pessoal; cada evento é confirmado contra o estado atual do provedor. @author André Narcizo */
    public function handle(string $eventId, string $eventType, string $paymentId, string $providerSubscriptionId): array
    {
        $hash = hash('sha256', json_encode([$eventType, $paymentId, $providerSubscriptionId], JSON_THROW_ON_ERROR));
        DB::table('webhook_events')->insertOrIgnore(['id' => (string) Str::uuid(), 'provider' => $this->provider->name(), 'provider_event_id' => $eventId, 'event_type' => $eventType, 'payload_hash' => $hash, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        try {
            return DB::transaction(function () use ($eventId, $hash, $eventType, $paymentId, $providerSubscriptionId): array {
                $event = DB::table('webhook_events')->where('provider', $this->provider->name())->where('provider_event_id', $eventId)->lockForUpdate()->first();
                abort_unless(hash_equals($event->payload_hash, $hash), 409, 'Evento reapresentado com conteúdo divergente.');
                if ($event->status === 'processed') {
                    return ['duplicate' => true];
                }
                $subscription = DB::table('subscriptions')->where('provider', $this->provider->name())->where('provider_subscription_id', $providerSubscriptionId)->lockForUpdate()->first();
                abort_unless($subscription, 409, 'Assinatura não reconciliada. Evento preservado para reprocessamento.');
                $payment = $this->provider->payment($paymentId);
                abort_unless(($payment['subscription'] ?? null) === $providerSubscriptionId, 409, 'Cobrança pertence a outra assinatura.');
                $customer = DB::table('billing_customers')->where('organization_id', $subscription->organization_id)->where('provider', $this->provider->name())->first();
                abort_unless($customer && ($payment['customer'] ?? null) === $customer->provider_customer_id, 409, 'Cliente de cobrança não reconciliado.');
                $this->apply($subscription, $payment, $eventId, $eventType);
                DB::table('webhook_events')->where('id', $event->id)->update(['status' => 'processed', 'attempts' => $event->attempts + 1, 'processed_at' => now(), 'updated_at' => now()]);

                return ['duplicate' => false];
            }, 3);
        } catch (Throwable $exception) {
            DB::table('webhook_events')->where('provider', $this->provider->name())->where('provider_event_id', $eventId)->where('status', '!=', 'processed')->update(['status' => 'failed', 'attempts' => DB::raw('attempts + 1'), 'updated_at' => now()]);
            throw $exception;
        }
    }

    private function apply(object $subscription, array $payment, string $eventId, string $eventType): void
    {
        abort_unless(isset($payment['id'], $payment['status'], $payment['value'], $payment['dueDate']), 502, 'Cobrança incompleta.');
        abort_unless(is_numeric($payment['value']) && (float) $payment['value'] >= 0, 502, 'Valor de cobrança inválido.');
        $amount = (int) round((float) $payment['value'] * 100);
        $dueDate = CarbonImmutable::createFromFormat('!Y-m-d', $payment['dueDate'], 'America/Sao_Paulo');
        abort_unless($dueDate && $dueDate->format('Y-m-d') === $payment['dueDate'], 502, 'Vencimento de cobrança inválido.');
        $version = DB::table('plan_versions')->where('id', $subscription->plan_version_id)->first();
        if ($subscription->pending_plan_version_id && (! $subscription->current_period_end || $dueDate->greaterThanOrEqualTo(CarbonImmutable::parse($subscription->current_period_end)))) {
            $version = DB::table('plan_versions')->where('id', $subscription->pending_plan_version_id)->first();
        }
        // Uma fatura histórica pode ter preço de versão anterior, já registrado no ledger.
        $existingInvoice = DB::table('invoices')->where('provider', $this->provider->name())->where('provider_invoice_id', $payment['id'])->first();
        abort_unless($amount === ($existingInvoice?->amount_cents ?? $version->price_cents), 409, 'Valor divergente do plano contratado; reconciliação necessária.');
        $status = match ($payment['status']) {
            'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH' => 'paid',
            'OVERDUE' => 'overdue',
            'REFUNDED' => 'refunded',
            'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL' => 'disputed',
            'PENDING', 'AWAITING_RISK_ANALYSIS', 'AUTHORIZED', 'DUNNING_REQUESTED' => 'pending',
            default => null,
        };
        abort_unless($status, 409, 'Estado financeiro não mapeado; revisão necessária.');
        $invoiceId = $existingInvoice?->id ?? (string) Str::uuid();
        $paidAt = $status === 'paid' ? ($existingInvoice?->paid_at ?? now()) : $existingInvoice?->paid_at;
        $invoice = ['organization_id' => $subscription->organization_id, 'subscription_id' => $subscription->id, 'provider' => $this->provider->name(), 'provider_invoice_id' => $payment['id'], 'status' => $status, 'amount_cents' => $amount, 'due_date' => $dueDate->format('Y-m-d'), 'paid_at' => $paidAt, 'updated_at' => now()];
        if ($existingInvoice) {
            abort_unless($existingInvoice->organization_id === $subscription->organization_id && $existingInvoice->subscription_id === $subscription->id, 409, 'Cobrança já vinculada a outra organização.');
            DB::table('invoices')->where('id', $invoiceId)->update($invoice);
        } else {
            DB::table('invoices')->insert(['id' => $invoiceId, 'created_at' => now()] + $invoice);
        }
        $refunded = $status === 'refunded' ? $amount : (int) round((float) ($payment['refundedValue'] ?? 0) * 100);
        abort_unless($refunded >= 0 && $refunded <= $amount, 409, 'Valor de estorno divergente.');
        $existingPayment = DB::table('payments')->where('provider', $this->provider->name())->where('provider_payment_id', $payment['id'])->first();
        DB::table('payments')->updateOrInsert(['provider' => $this->provider->name(), 'provider_payment_id' => $payment['id']], ['id' => $existingPayment?->id ?? (string) Str::uuid(), 'organization_id' => $subscription->organization_id, 'invoice_id' => $invoiceId, 'status' => $payment['status'], 'amount_cents' => $amount, 'refunded_cents' => $refunded, 'created_at' => $existingPayment?->created_at ?? now(), 'updated_at' => now()]);

        $updates = [];
        $isCurrentCycle = ! $subscription->current_period_start || $dueDate->greaterThanOrEqualTo(CarbonImmutable::parse($subscription->current_period_start)->startOfDay());
        if ($status === 'paid' && $isCurrentCycle && $subscription->status !== 'canceled' && ! $subscription->cancel_at_period_end) {
            $end = $version->interval === 'yearly' ? $dueDate->addYearNoOverflow() : $dueDate->addMonthNoOverflow();
            $updates = ['status' => 'active', 'current_period_start' => $dueDate->utc(), 'current_period_end' => $end->utc(), 'grace_ends_at' => null, 'plan_version_id' => $version->id, 'pending_plan_version_id' => $version->id === $subscription->pending_plan_version_id ? null : $subscription->pending_plan_version_id];
        } elseif ($isCurrentCycle && in_array($status, ['refunded', 'disputed'], true) && $subscription->status !== 'canceled') {
            $updates = ['status' => 'suspended', 'grace_ends_at' => null];
        } elseif ($status === 'overdue' && $isCurrentCycle && $subscription->status !== 'canceled' && ! $subscription->cancel_at_period_end) {
            $grace = $dueDate->addDays(max(0, (int) config('billing.grace_days')));
            $updates = ['status' => $grace->isFuture() ? 'past_due' : 'suspended', 'grace_ends_at' => $grace->utc()];
        }
        if ($updates) {
            DB::table('subscriptions')->where('id', $subscription->id)->update($updates + ['updated_at' => now()]);
        }
        SubscriptionService::audit($subscription->organization_id, $subscription->id, 'provider.'.$eventType, $subscription->status, $updates['status'] ?? $subscription->status, $eventId);
    }
}
