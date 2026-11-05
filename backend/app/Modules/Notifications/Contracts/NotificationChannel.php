<?php

declare(strict_types=1);

namespace Modules\Notifications\Contracts;

use Modules\Notifications\DataObjects\OutboundMessage;
use Modules\Notifications\DataObjects\SendResult;

/**
 * Desacopla o envio do provedor (WhatsApp Cloud API / Twilio). A aplicação nunca fala
 * diretamente com o SDK de um provedor específico.
 */
interface NotificationChannel
{
    public function name(): string;

    /**
     * Envia a mensagem. Deve ser idempotente do lado do chamador via correlationId.
     */
    public function send(OutboundMessage $message): SendResult;
}
