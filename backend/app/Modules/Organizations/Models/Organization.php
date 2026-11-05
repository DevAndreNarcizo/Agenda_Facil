<?php

declare(strict_types=1);

namespace Modules\Organizations\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Billing\Models\Subscription;

/**
 * Organização = tenant principal. Dono (owner_id) sempre tem um membership 'owner'.
 */
class Organization extends Model
{
    use HasUuids;

    protected $fillable = [
        'name', 'slug', 'owner_id', 'logo_url', 'primary_color', 'onboarding_completed_at',
    ];

    protected function casts(): array
    {
        return ['onboarding_completed_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return HasMany<Membership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /** @return HasOne<OrganizationSettings, $this> */
    public function settings(): HasOne
    {
        return $this->hasOne(OrganizationSettings::class);
    }

    /** @return HasMany<Subscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Assinatura "viva" atual da organização (no máximo uma, garantida por índice parcial).
     *
     * @return HasOne<Subscription, $this>
     */
    public function liveSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->whereNot('status', 'canceled')
            ->latestOfMany();
    }
}
