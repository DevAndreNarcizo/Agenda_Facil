<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Mockery;
use Tests\TestCase;

final class DatabaseLogPrivacyTest extends TestCase
{
    /** Erros SQL não podem copiar bindings, senhas ou dados pessoais para o log padrão. @author André Narcizo */
    public function test_database_exception_logs_only_sanitized_diagnostic_without_bindings(): void
    {
        Log::spy();
        $exception = new QueryException('pgsql', 'INSERT INTO customers(email, name) VALUES (?, ?)',
            ['private-customer@example.test', 'synthetic-sensitive-sentinel'],
            new \PDOException('synthetic-sensitive-sentinel', 23505));

        report($exception);

        Log::shouldHaveReceived('error')->once()->with('database.operation_failed', Mockery::on(function (array $context): bool {
            $encoded = json_encode($context, JSON_THROW_ON_ERROR);

            return $context['sql_state'] === '23505'
                && ! str_contains($encoded, 'private-customer')
                && ! str_contains($encoded, 'synthetic-sensitive-sentinel')
                && ! str_contains($encoded, 'INSERT');
        }));
        Log::shouldNotHaveReceived('log');
    }
}
