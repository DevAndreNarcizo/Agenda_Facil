<?php

declare(strict_types=1);

namespace Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Scheduling\Models\Appointment;

/**
 * Entrega de mensagem na outbox. Estado e lease de processamento; sem dados sensíveis.
 */
class MessageDelivery extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'appointment_id', 'channel', 'template_name', 'status',
        'attempts', 'max_attempts', 'scheduled_for', 'next_attempt_at',
        'lock_token', 'lock_expires_at', 'sent_at', 'last_error_code', 'provider_message_id',
    ];

    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'max_attempts' => 'integer',
            'scheduled_for' => 'datetime',
            'next_attempt_at' => 'datetime',
            'lock_expires_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Appointment, $this> */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}
