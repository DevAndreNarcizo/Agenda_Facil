<?php

declare(strict_types=1);

namespace Modules\Billing;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Modules\Billing\Contracts\BillingProvider;
use Modules\Billing\Providers\FakeBillingProvider;
use RuntimeException;

/**
 * Registra a implementação de BillingProvider conforme a configuração e os rate limiters
 * nomeados usados pelas rotas de autenticação e webhooks.
 */
final class BillingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BillingProvider::class, function (): BillingProvider {
            $provider = (string) config('billing.provider', 'fake');

            return match ($provider) {
                'fake' => new FakeBillingProvider,
                // 'stripe' => new Providers\StripeBillingProvider(...),  // requer SDK + credenciais
                // 'asaas'  => new Providers\AsaasBillingProvider(...),
                default => throw new RuntimeException("Provedor de cobrança não suportado: {$provider}"),
            };
        });
    }

    public function boot(): void
    {
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        // Portal/reserva pública: limites por IP (defesa adicional ao rate-limit por telefone).
        RateLimiter::for('portal-otp', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('public-booking', fn (Request $request) => Limit::perMinute(20)->by($request->ip()));
    }
}
