<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Ledger de webhooks: idempotência (unique provider+event_id) e proteção contra replay.
 */
class WebhookEvent extends Model
{
    use HasUuids;

    protected $fillable = [
        'provider', 'provider_event_id', 'event_type', 'status', 'error_code', 'payload', 'processed_at',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array', 'processed_at' => 'datetime'];
    }
}
