<?php

declare(strict_types=1);

return [
    // Canal ativo. fake = sintético (dev/test). whatsapp requer credenciais (bloqueio externo).
    'channel' => env('NOTIFICATIONS_CHANNEL', 'fake'),

    'whatsapp' => [
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
    ],
];
