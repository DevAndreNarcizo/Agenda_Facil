<?php

use App\Http\Middleware\EnsureSubscriptionIsUsable;
use App\Http\Middleware\ResolveTenantContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Modules\Billing\Exceptions\QuotaExceededException;
use Modules\CustomerPortal\Exceptions\PortalRateLimitException;
use Modules\PublicBooking\Exceptions\PublicBookingUnavailableException;
use Modules\Scheduling\Exceptions\SchedulingConflictException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Autenticação da SPA Angular por token Bearer (Sanctum `auth:sanctum`), sem sessão
        // stateful/CSRF — por isso NÃO usamos statefulApi(). CORS liberado em config/cors.php.

        // Alias de autorização por recurso/tenant usados nas rotas da API.
        $middleware->alias([
            'tenant.context' => ResolveTenantContext::class,
            'subscription.active' => EnsureSubscriptionIsUsable::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Conflito de agenda -> 409.
        $exceptions->render(function (SchedulingConflictException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], 409);
            }

            return null;
        });

        // Cota de plano excedida -> 402 (pagamento necessário / upgrade).
        $exceptions->render(function (QuotaExceededException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'entitlement' => $e->entitlementKey,
                    'limit' => $e->limit,
                ], 402);
            }

            return null;
        });

        // Reserva pública indisponível / recurso não permitido -> 404 (não vaza dados de outra org).
        $exceptions->render(function (PublicBookingUnavailableException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], 404);
            }

            return null;
        });

        // Rate-limit de OTP do portal -> 429.
        $exceptions->render(function (PortalRateLimitException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], 429);
            }

            return null;
        });
    })->create();
