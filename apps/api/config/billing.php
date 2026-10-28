<?php

declare(strict_types=1);

return [
    'provider' => 'asaas',
    'enabled' => env('BILLING_ENABLED', false),
    'homologated' => env('BILLING_HOMOLOGATED', false),
    'local_fixtures' => env('BILLING_LOCAL_FIXTURES', true),
    'grace_days' => (int) env('BILLING_GRACE_DAYS', 0),
    'asaas' => [
        'base_url' => 'https://api-sandbox.asaas.com/v3',
        'api_key' => env('ASAAS_API_KEY'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
    ],
];
