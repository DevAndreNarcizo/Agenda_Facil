<?php

declare(strict_types=1);

namespace Modules\CustomerPortal\DataObjects;

/**
 * Resultado de uma solicitação de OTP. A resposta ao cliente é sempre genérica
 * (anti-enumeração); `debugCode` só é preenchido em dev/test para verificação.
 */
final readonly class OtpRequestResult
{
    private function __construct(
        public bool $issued,
        public ?string $debugCode = null,
    ) {}

    public static function generic(): self
    {
        return new self(false, null);
    }

    public static function issued(?string $debugCode): self
    {
        return new self(true, $debugCode);
    }
}
