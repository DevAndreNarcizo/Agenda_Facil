<?php

declare(strict_types=1);

namespace App\Domains\Billing\Http;

use App\Domains\Billing\Contracts\BillingProvider;
use App\Domains\Billing\Services\WebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AsaasWebhookController
{
    public function __invoke(Request $request, BillingProvider $provider, WebhookService $service): JsonResponse
    {
        $expected = config('billing.asaas.webhook_token');
        abort_unless(is_string($expected) && strlen($expected) >= 32, 503, 'Webhook de cobrança não configurado.');
        $provided = $request->header('asaas-access-token');
        abort_unless(is_string($provided) && hash_equals($expected, $provided), 401, 'Autenticação do webhook inválida.');
        $provider->assertAvailable();
        $data = $request->validate(['id' => ['required', 'string', 'max:200'], 'event' => ['required', 'string', 'max:80'], 'payment.id' => ['required', 'string', 'max:100'], 'payment.subscription' => ['required', 'string', 'max:100']]);
        abort_unless(str_starts_with($data['event'], 'PAYMENT_'), 422, 'Evento fora do contrato de cobranças.');

        return response()->json(['data' => $service->handle($data['id'], $data['event'], $data['payment']['id'], $data['payment']['subscription'])]);
    }
}
