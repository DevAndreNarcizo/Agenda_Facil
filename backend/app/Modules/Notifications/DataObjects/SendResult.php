<?php

declare(strict_types=1);

namespace Modules\Notifications\DataObjects;

/**
 * Resultado de um envio. `retriable` distingue falha transitória (tenta de novo) de
 * permanente (marca failed). `unknown` = provedor aceitou mas confirmação incerta.
 */
final readonly class SendResult
{
    private function __construct(
        public bool $sent,
        public bool $retriable,
        public bool $unknown,
        public ?string $providerMessageId,
        public ?string $errorCode,
    ) {}

    public static function sent(?string $providerMessageId = null): self
    {
        return new self(true, false, false, $providerMessageId, null);
    }

    public static function failed(string $errorCode, bool $retriable): self
    {
        return new self(false, $retriable, false, null, $errorCode);
    }

    public static function unknown(string $errorCode): self
    {
        return new self(false, false, true, null, $errorCode);
    }
}
