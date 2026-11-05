<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // SPA stateful (cookie HttpOnly + CSRF) via Sanctum para a aplicação Angular.
        $middleware->statefulApi();

        // Alias de autorização por recurso/tenant usados nas rotas da API.
        $middleware->alias([
            'tenant.context' => \App\Http\Middleware\ResolveTenantContext::class,
            'subscription.active' => \App\Http\Middleware\EnsureSubscriptionIsUsable::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Conflito de agenda -> 409.
        $exceptions->render(function (\Modules\Scheduling\Exceptions\SchedulingConflictException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], 409);
            }

            return null;
        });

        // Cota de plano excedida -> 402 (pagamento necessário / upgrade).
        $exceptions->render(function (\Modules\Billing\Exceptions\QuotaExceededException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'entitlement' => $e->entitlementKey,
                    'limit' => $e->limit,
                ], 402);
            }

            return null;
        });
    })->create();
