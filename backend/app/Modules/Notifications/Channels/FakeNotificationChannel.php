<?php

declare(strict_types=1);

namespace Modules\Notifications\Channels;

use Illuminate\Support\Str;
use Modules\Notifications\Contracts\NotificationChannel;
use Modules\Notifications\DataObjects\OutboundMessage;
use Modules\Notifications\DataObjects\SendResult;

/**
 * Canal sintético para dev/test (sem dependência externa). Registra os envios em memória
 * para asserção nos testes. NÃO usar em produção.
 */
final class FakeNotificationChannel implements NotificationChannel
{
    /** @var list<OutboundMessage> */
    public array $sent = [];

    /** Força o próximo envio a falhar (transitório ou permanente) para testar o backoff. */
    public ?SendResult $nextResult = null;

    public function name(): string
    {
        return 'fake';
    }

    public function send(OutboundMessage $message): SendResult
    {
        if ($this->nextResult !== null) {
            $result = $this->nextResult;
            $this->nextResult = null;

            return $result;
        }

        $this->sent[] = $message;

        return SendResult::sent('fake_'.Str::random(12));
    }
}
