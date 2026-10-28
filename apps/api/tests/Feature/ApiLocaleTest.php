<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class ApiLocaleTest extends TestCase
{
    public function test_validation_errors_are_returned_in_brazilian_portuguese(): void
    {
        app()->setLocale('pt_BR');
        $this->postJson('/api/v1/auth/register', ['organization_id' => 'synthetic-forbidden-tenant'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'O campo nome é obrigatório.')
            ->assertJsonPath('errors.password.0', 'O campo senha é obrigatório.')
            ->assertJsonPath('errors.organization_id.0', 'Não envie organização nesta operação.');
    }
}
