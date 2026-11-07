<?php

declare(strict_types=1);

namespace Modules\CustomerPortal\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PortalOtpChallenge extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'customer_id', 'phone_normalized', 'code_hash',
        'attempts', 'expires_at', 'consumed_at',
    ];

    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
