<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domains\Billing\Contracts\BillingProvider;
use App\Domains\Billing\Providers\AsaasBillingProvider;
use App\Domains\Customers\Models\Customer;
use App\Domains\Memberships\Policies\TenantResourcePolicy;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Services\Models\Service;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BillingProvider::class, AsaasBillingProvider::class);
    }

    public function boot(): void
    {
        Sanctum::getAccessTokenFromRequestUsing(static fn () => null);
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim((string) config('app.frontend_url'), '/').'/reset-password#token='.urlencode($token).'&email='.urlencode($user->email));
        foreach ([Customer::class, Professional::class, Service::class] as $model) {
            Gate::policy($model, TenantResourcePolicy::class);
        }
        RateLimiter::for('auth', fn (Request $request) => [Limit::perMinute(10)->by($request->ip()), Limit::perMinute(5)->by(hash('sha256', strtolower((string) $request->input('email')).'|'.$request->ip()))]);
        // Operações autenticadas não compartilham a chave de email vazia do limitador de senha.
        foreach (['onboarding' => 10, 'membership-accept' => 10, 'tenant-switch' => 20] as $name => $perUser) {
            RateLimiter::for($name, fn (Request $request) => [
                Limit::perMinute($perUser)->by('actor:'.($request->user()?->id ?? $request->ip())),
                Limit::perMinute(60)->by('ip:'.$request->ip()),
            ]);
        }
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('bookings', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(300)->by($request->ip()));
    }
}
