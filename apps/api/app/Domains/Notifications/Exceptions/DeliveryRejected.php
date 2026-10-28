<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Exceptions;

/** Use somente quando o provedor comprovar que não aceitou a mensagem. @author André Narcizo */
final class DeliveryRejected extends \RuntimeException
{
    public function __construct()
    {
        parent::__construct('O provedor recusou a mensagem antes do envio.');
    }
}
