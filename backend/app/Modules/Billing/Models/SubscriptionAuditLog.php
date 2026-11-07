<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SubscriptionAuditLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'subscription_id', 'action', 'from_status', 'to_status',
        'context', 'actor_user_id', 'source',
    ];

    protected function casts(): array
    {
        return ['context' => 'array'];
    }
}
