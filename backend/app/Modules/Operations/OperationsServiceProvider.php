<?php

declare(strict_types=1);

namespace Modules\Operations;

use Illuminate\Support\ServiceProvider;
use Modules\Operations\Console\MigrateSupabaseCommand;

/**
 * Registra os comandos de operações (migração de dados do Supabase).
 */
final class OperationsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([MigrateSupabaseCommand::class]);
        }
    }
}
