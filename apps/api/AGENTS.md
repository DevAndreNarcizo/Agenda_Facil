# Agenda Fácil API

PHP >=8.4, Laravel 13, monólito modular em `app/Domains`. PostgreSQL é o único banco de desenvolvimento e testes; não usar SQLite. Sessão SPA Sanctum com CSRF. Tenant vem da sessão e de membership ativa no servidor; nunca confiar em tenant/role do browser. Controllers finos, actions transacionais e policies por recurso. IDs importáveis são UUIDs. Dados de testes sintéticos. `php artisan test`, `vendor/bin/pint --test`, `composer audit`. Não modificar remoto, produção ou credenciais. Não realizar commit/push/deploy por inferência.
