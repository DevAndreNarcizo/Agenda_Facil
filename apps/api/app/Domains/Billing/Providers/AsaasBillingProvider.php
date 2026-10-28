<?php

declare(strict_types=1);

namespace App\Domains\Billing\Providers;

use App\Domains\Billing\Contracts\BillingProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

final class AsaasBillingProvider implements BillingProvider
{
    public function name(): string
    {
        return 'asaas';
    }

    public function assertAvailable(): void
    {
        abort_unless(config('billing.enabled') && config('billing.homologated') && config('billing.asaas.api_key'), 503, 'Cobrança indisponível: integração Asaas ainda não homologada.');
        // Esta versão somente permite sandbox. Produção exige autorização e rollout próprios.
        abort_unless(config('billing.asaas.base_url') === 'https://api-sandbox.asaas.com/v3', 503, 'Ambiente de cobrança não autorizado.');
    }

    public function checkout(object $subscription, object $planVersion, string $reference): array
    {
        $url = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/dashboard/subscription';
        $result = $this->request('POST', '/checkouts', [
            'billingTypes' => ['CREDIT_CARD'],
            'chargeTypes' => ['RECURRENT'],
            'minutesToExpire' => 60,
            'externalReference' => $reference,
            'callback' => ['successUrl' => $url, 'cancelUrl' => $url, 'expiredUrl' => $url],
            'items' => [['name' => 'Agenda Fácil', 'quantity' => 1, 'value' => $planVersion->price_cents / 100]],
            'subscription' => [
                'cycle' => $planVersion->interval === 'yearly' ? 'YEARLY' : 'MONTHLY',
                'nextDueDate' => now()->format('Y-m-d H:i:s'),
            ],
        ]);
        abort_unless(is_array($result) && is_string($result['id'] ?? null), 502, 'Resposta de checkout inválida.');

        return ['id' => $result['id'], 'url' => 'https://sandbox.asaas.com/checkoutSession/show?id='.rawurlencode($result['id']), 'expires_at' => now()->addHour()->toIso8601String()];
    }

    public function payment(string $paymentId): array
    {
        abort_unless(preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $paymentId) === 1, 422, 'Identificador de cobrança inválido.');
        $data = $this->request('GET', '/payments/'.$paymentId);
        abort_unless(is_array($data) && ($data['id'] ?? null) === $paymentId, 502, 'Cobrança inválida no provedor.');

        // Nunca devolver/persistir objeto bruto: pode incluir dados de cartão e pessoais.
        return array_intersect_key($data, array_flip(['id', 'subscription', 'customer', 'status', 'value', 'dueDate', 'paymentDate', 'confirmedDate', 'refundedValue']));
    }

    public function changePlan(object $subscription, object $planVersion): void
    {
        abort_unless($subscription->provider_subscription_id, 409, 'Assinatura ainda não vinculada ao provedor.');
        $this->request('PUT', '/subscriptions/'.rawurlencode($subscription->provider_subscription_id), [
            'value' => $planVersion->price_cents / 100,
            'cycle' => $planVersion->interval === 'yearly' ? 'YEARLY' : 'MONTHLY',
            'updatePendingPayments' => false,
        ]);
    }

    public function payments(string $subscriptionId): array
    {
        abort_unless(preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $subscriptionId) === 1, 422, 'Identificador de assinatura inválido.');
        $payments = [];
        for ($page = 0; $page < 100; $page++) {
            $data = $this->request('GET', '/subscriptions/'.$subscriptionId.'/payments', ['offset' => $page * 100, 'limit' => 100]);
            abort_unless(is_array($data) && is_array($data['data'] ?? null), 502, 'Lista de cobranças inválida.');
            foreach ($data['data'] as $payment) {
                abort_unless(is_string($payment['id'] ?? null), 502, 'Cobrança sem identificador.');
                $payments[] = ['id' => $payment['id']];
            }
            if (! ($data['hasMore'] ?? false)) {
                return $payments;
            }
        }
        abort(503, 'Reconciliação excedeu limite seguro de paginação; revisão necessária.');
    }

    public function cancel(object $subscription, bool $atPeriodEnd): void
    {
        abort_unless($subscription->provider_subscription_id, 409, 'Assinatura ainda não vinculada ao provedor.');
        // Interrompe futuras cobranças no provedor; o período já pago é controlado localmente.
        $this->request('DELETE', '/subscriptions/'.rawurlencode($subscription->provider_subscription_id));
    }

    /** Não propaga corpo de erro remoto, que pode conter informação pessoal. @author André Narcizo */
    private function request(string $method, string $url, array $data = []): array
    {
        try {
            $options = $method === 'GET' ? ['query' => $data] : ($data ? ['json' => $data] : []);
            $response = $this->http()->send($method, $url, $options);
            abort_unless($response->successful(), 503, 'Provedor de cobrança temporariamente indisponível.');
            $result = $response->json() ?? [];
            abort_unless(is_array($result), 502, 'Resposta de cobrança inválida.');

            return $result;
        } catch (ConnectionException) {
            abort(503, 'Não foi possível confirmar a resposta do provedor de cobrança.');
        }
    }

    private function http(): PendingRequest
    {
        $this->assertAvailable();

        return Http::baseUrl(config('billing.asaas.base_url'))
            ->withHeaders(['access_token' => config('billing.asaas.api_key'), 'User-Agent' => 'AgendaFacil/1.0'])
            ->acceptJson()->asJson()->connectTimeout(5)->timeout(15);
    }
}
