<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Limite ou recurso de um plano (enforcement no servidor). value_int null = ilimitado.
 */
class PlanEntitlement extends Model
{
    use HasUuids;

    protected $fillable = ['plan_version_id', 'key', 'value_int', 'value_bool'];

    protected function casts(): array
    {
        return ['value_int' => 'integer', 'value_bool' => 'boolean'];
    }

    /** @return BelongsTo<PlanVersion, $this> */
    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(PlanVersion::class);
    }
}
