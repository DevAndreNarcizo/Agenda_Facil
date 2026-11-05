<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Plano comercial. Fonte autoritativa no servidor (corrige planos/preços no frontend).
 */
class Plan extends Model
{
    use HasUuids;

    protected $fillable = ['code', 'name', 'subtitle', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    /** @return HasMany<PlanVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(PlanVersion::class);
    }

    /** @return HasOne<PlanVersion, $this> */
    public function currentVersion(): HasOne
    {
        return $this->hasOne(PlanVersion::class)->where('is_current', true);
    }
}
