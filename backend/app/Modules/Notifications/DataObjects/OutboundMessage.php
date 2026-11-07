<?php

declare(strict_types=1);

namespace Modules\Notifications\DataObjects;

/**
 * Mensagem a enviar. Montada pelo serviço; o canal só transmite.
 */
final readonly class OutboundMessage
{
    /**
     * @param  list<string>  $parameters
     */
    public function __construct(
        public string $recipientPhone,
        public string $templateName,
        public array $parameters,
        public string $correlationId,
    ) {}
}
