<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Contador de uso por organização/chave/período. Incrementado de forma transacional/concorrente.
 */
class UsageCounter extends Model
{
    use HasUuids;

    protected $fillable = ['organization_id', 'key', 'period', 'value'];

    protected function casts(): array
    {
        return ['value' => 'integer'];
    }
}
