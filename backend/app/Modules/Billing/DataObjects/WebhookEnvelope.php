<?php

declare(strict_types=1);

namespace Modules\Billing\DataObjects;

/**
 * Evento de webhook normalizado, independente do provedor. O handler reage a 'type'
 * sem conhecer o formato cru do gateway.
 */
final readonly class WebhookEnvelope
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public string $provider,
        public string $eventId,
        public string $type,
        public array $data,
    ) {}

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->data[$key] ?? $default;
    }
}
