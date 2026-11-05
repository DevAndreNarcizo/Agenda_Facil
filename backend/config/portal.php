<?php

declare(strict_types=1);

return [
    // Pepper para hash de OTP/telefone/IP e token de sessão do portal.
    'token_pepper' => env('PORTAL_TOKEN_PEPPER', 'dev-pepper'),
];
