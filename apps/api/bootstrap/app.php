<?php

declare(strict_types=1);

use App\Http\Middleware\ResolveTenant;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['tenant' => ResolveTenant::class]);
        $middleware->validateCsrfTokens(except: ['api/v1/billing/webhooks/asaas']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        // PDO/QueryException incluem bindings na mensagem; registrar só diagnóstico sem dados do cliente.
        $exceptions->report(function (PDOException $exception): bool {
            $state = (string) $exception->getCode();
            Log::error('database.operation_failed', [
                'sql_state' => preg_match('/^[A-Z0-9]{5}$/D', $state) ? $state : 'unknown',
                'route' => request()->route()?->uri() ?? 'console',
            ]);

            return false;
        });
    })->create();
