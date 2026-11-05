<?php

declare(strict_types=1);

namespace Modules\CustomerPortal\DataObjects;

/**
 * Sessão opaca criada após verificação do OTP. O token é devolvido uma única vez.
 */
final readonly class PortalSessionResult
{
    public function __construct(
        public string $token,
        public string $expiresAt,
        public string $customerId,
    ) {}
}
