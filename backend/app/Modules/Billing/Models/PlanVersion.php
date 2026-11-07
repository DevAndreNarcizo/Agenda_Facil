<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Versão de plano: congela preço e price_id do gateway. Assinaturas existentes mantêm sua
 * versão quando o preço muda (uma nova versão é criada).
 */
class PlanVersion extends Model
{
    use HasUuids;

    protected $fillable = [
        'plan_id', 'version', 'price_cents', 'currency', 'billing_interval',
        'gateway', 'gateway_price_id', 'is_current',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'price_cents' => 'integer',
            'is_current' => 'boolean',
        ];
    }

    /** @return BelongsTo<Plan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** @return HasMany<PlanEntitlement, $this> */
    public function entitlements(): HasMany
    {
        return $this->hasMany(PlanEntitlement::class);
    }

    /**
     * Valor inteiro de um entitlement (ex.: limite de profissionais). null = ilimitado/ausente.
     */
    public function limit(string $key): ?int
    {
        $entitlement = $this->entitlements->firstWhere('key', $key);

        return $entitlement?->value_int;
    }

    /**
     * Flag booleana de um recurso premium.
     */
    public function allows(string $key): bool
    {
        return (bool) ($this->entitlements->firstWhere('key', $key)?->value_bool);
    }
}
