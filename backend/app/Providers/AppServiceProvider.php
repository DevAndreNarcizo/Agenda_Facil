<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Organizations\Services\TenantContext;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Contexto de tenant resolvido por request — singleton no container.
        $this->app->scoped(TenantContext::class);
    }

    public function boot(): void
    {
        //
    }
}
