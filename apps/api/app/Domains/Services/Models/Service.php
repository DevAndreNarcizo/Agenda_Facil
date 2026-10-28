<?php

declare(strict_types=1);

namespace App\Domains\Services\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    use HasUuids;

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'duration_minutes' => 'integer', 'price_cents' => 'integer'];
    }
}
