<?php

declare(strict_types=1);

return [
    /*
    | Provedor de cobrança ativo. Desacoplado via interface BillingProvider.
    | fake  -> sintético (dev/test, sem dependência externa)
    | stripe -> gateway Stripe (requer credenciais)
    | asaas  -> gateway Asaas (primeira opção comercial, condicionado à homologação)
    */
    'provider' => env('BILLING_PROVIDER', 'fake'),

    'trial_days' => (int) env('BILLING_TRIAL_DAYS', 14),
    'grace_days' => (int) env('BILLING_GRACE_DAYS', 7),

    'fake_webhook_secret' => env('BILLING_FAKE_WEBHOOK_SECRET', 'fake-secret'),

    'stripe' => [
        'secret' => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'asaas' => [
        'api_key' => env('ASAAS_API_KEY'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
    ],
];
