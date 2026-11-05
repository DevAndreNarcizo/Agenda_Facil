<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Contracts\BillingProvider;
use Modules\Billing\Services\WebhookProcessor;
use Throwable;

/**
 * Recebe webhooks do gateway. A origem/assinatura é validada pelo BillingProvider;
 * a idempotência e as transições ficam no WebhookProcessor.
 */
final class WebhookController extends Controller
{
    public function handle(
        string $provider,
        Request $request,
        BillingProvider $billingProvider,
        WebhookProcessor $processor,
    ): JsonResponse {
        if ($provider !== $billingProvider->name()) {
            return response()->json(['error' => 'Provedor inesperado.'], 400);
        }

        try {
            $envelope = $billingProvider->parseWebhook($request->getContent(), $this->headers($request));
        } catch (Throwable) {
            // Assinatura inválida: não vaza detalhes.
            return response()->json(['error' => 'Webhook inválido.'], 400);
        }

        try {
            $result = $processor->process($envelope);
        } catch (Throwable) {
            return response()->json(['error' => 'Falha ao processar.'], 500);
        }

        return response()->json(['received' => true, 'result' => $result]);
    }

    /**
     * @return array<string, string>
     */
    private function headers(Request $request): array
    {
        $headers = [];
        foreach ($request->headers->all() as $key => $values) {
            $headers[$key] = is_array($values) ? (string) ($values[0] ?? '') : (string) $values;
        }

        return $headers;
    }
}
