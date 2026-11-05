<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Billing\PlanController;
use App\Http\Controllers\Api\V1\Billing\SubscriptionController;
use App\Http\Controllers\Api\V1\Billing\WebhookController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\ProfessionalController;
use App\Http\Controllers\Api\V1\Public\PortalController;
use App\Http\Controllers\Api\V1\Public\PublicBookingController;
use App\Http\Controllers\Api\V1\Scheduling\AppointmentController;
use App\Http\Controllers\Api\V1\ServiceController;
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

    // Reserva pública por link (slug) + portal do cliente (OTP + sessão opaca).
    Route::prefix('public/{slug}')->group(function (): void {
        Route::get('context', [PublicBookingController::class, 'context']);
        Route::post('portal/otp/request', [PortalController::class, 'requestOtp'])->middleware('throttle:portal-otp');
        Route::post('portal/otp/verify', [PortalController::class, 'verifyOtp'])->middleware('throttle:portal-otp');
        Route::post('portal/booking', [PortalController::class, 'createBooking'])->middleware('throttle:public-booking');
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // Operações no contexto da organização resolvido pelo servidor.
        Route::middleware('tenant.context')->group(function (): void {
            // Organização / onboarding (não exige assinatura ativa — faz parte do setup).
            Route::get('organization', [OrganizationController::class, 'show']);
            Route::post('organization/onboarding', [OrganizationController::class, 'completeOnboarding']);

            // Assinatura — administração (owner). Não exige assinatura ativa (regularização).
            Route::get('subscription', [SubscriptionController::class, 'show']);
            Route::post('subscription/checkout', [SubscriptionController::class, 'checkout'])->middleware('throttle:auth');
            Route::post('subscription/change-plan', [SubscriptionController::class, 'changePlan']);
            Route::post('subscription/cancel', [SubscriptionController::class, 'cancel']);

            // Núcleo operacional — exige assinatura utilizável (trial/active/grace).
            Route::middleware('subscription.active')->group(function (): void {
                // Serviços
                Route::get('services', [ServiceController::class, 'index']);
                Route::post('services', [ServiceController::class, 'store']);
                Route::patch('services/{service}', [ServiceController::class, 'update']);

                // Profissionais (cota do plano aplicada na criação)
                Route::get('professionals', [ProfessionalController::class, 'index']);
                Route::post('professionals', [ProfessionalController::class, 'store']);

                // Clientes
                Route::get('customers', [CustomerController::class, 'index']);
                Route::post('customers', [CustomerController::class, 'store']);

                // Agenda
                Route::get('appointments', [AppointmentController::class, 'index']);
                Route::post('appointments', [AppointmentController::class, 'store']);
                Route::post('appointments/{appointment}/reschedule', [AppointmentController::class, 'reschedule']);
                Route::post('appointments/{appointment}/status', [AppointmentController::class, 'updateStatus']);
            });
        });
    });
});
