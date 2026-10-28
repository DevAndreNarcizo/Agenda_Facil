<?php

declare(strict_types=1);

return [
    'enabled' => env('NOTIFICATIONS_ENABLED', false),
    'homologated' => env('NOTIFICATIONS_HOMOLOGATED', false),
    'channel' => 'whatsapp',
    'lease_seconds' => 600,
    'max_attempts' => 5,
];
