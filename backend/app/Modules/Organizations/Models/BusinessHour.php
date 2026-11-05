<?php

declare(strict_types=1);

namespace Modules\Organizations\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Horário de funcionamento por dia da semana (0=domingo .. 6=sábado).
 */
class BusinessHour extends Model
{
    use HasUuids;

    protected $table = 'business_hours';

    protected $fillable = [
        'organization_id', 'day_of_week', 'start_time', 'end_time', 'is_active',
    ];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer', 'is_active' => 'boolean'];
    }
}
