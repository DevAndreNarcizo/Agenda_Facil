<?php

declare(strict_types=1);

/**
 * CORS para a SPA Angular. A autenticação usa token Bearer (Sanctum), não cookies de sessão,
 * então não é necessário supports_credentials. Em produção, restrinja allowed_origins ao domínio real.
 */
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:4200'),
        'http://localhost:4200',
        'http://127.0.0.1:4200',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
