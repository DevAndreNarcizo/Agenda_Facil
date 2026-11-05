<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Billing\PlanController;
use App\Http\Controllers\Api\V1\Billing\SubscriptionController;
use App\Http\Controllers\Api\V1\Billing\WebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1 — versionada (OpenAPI em docs/api/openapi.yaml)
|--------------------------------------------------------------------------
| O servidor é a autoridade sobre tenant, permissões, cotas, preço e assinatura.
*/

Route::prefix('v1')->group(function (): void {
    // Webhooks de pagamento: sem auth de sessão; validados por assinatura do provedor.
    Route::post('billing/webhook/{provider}', [WebhookController::class, 'handle'])
        ->middleware('throttle:webhooks');

    // Autenticação (Sanctum SPA).
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:auth');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth');

    // Catálogo de planos — leitura pública (fonte no servidor).
    Route::get('plans', [PlanController::class, 'index']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // Operações no contexto da organização resolvido pelo servidor.
        Route::middleware('tenant.context')->group(function (): void {
            // Assinatura — administração (owner). Não exige assinatura ativa (regularização).
            Route::get('subscription', [SubscriptionController::class, 'show']);
            Route::post('subscription/checkout', [SubscriptionController::class, 'checkout'])->middleware('throttle:auth');
            Route::post('subscription/change-plan', [SubscriptionController::class, 'changePlan']);
            Route::post('subscription/cancel', [SubscriptionController::class, 'cancel']);
        });
    });
});
