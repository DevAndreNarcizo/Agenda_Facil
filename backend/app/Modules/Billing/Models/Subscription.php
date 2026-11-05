<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Billing\Enums\SubscriptionStatus;
use Modules\Organizations\Models\Organization;

/**
 * Assinatura de uma organização. Status canônico único; trial não reutilizável;
 * 'active' só por evento autenticado de pagamento confirmado.
 */
class Subscription extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'plan_version_id', 'gateway', 'gateway_subscription_id',
        'status', 'trial_used', 'trial_ends_at', 'current_period_start', 'current_period_end',
        'grace_ends_at', 'cancel_at_period_end', 'canceled_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => SubscriptionStatus::class,
            'trial_used' => 'boolean',
            'cancel_at_period_end' => 'boolean',
            'trial_ends_at' => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'grace_ends_at' => 'datetime',
            'canceled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return BelongsTo<PlanVersion, $this> */
    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(PlanVersion::class);
    }

    public function grantsPaidAccess(): bool
    {
        return $this->status->grantsPaidAccess();
    }
}
