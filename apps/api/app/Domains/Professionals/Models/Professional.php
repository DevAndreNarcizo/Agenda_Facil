<?php

declare(strict_types=1);

namespace App\Domains\Professionals\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Professional extends Model
{
    use HasUuids;

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
