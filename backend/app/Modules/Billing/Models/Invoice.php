<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Organizations\Models\Organization;

class Invoice extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'subscription_id', 'gateway', 'gateway_invoice_id',
        'status', 'amount_cents', 'currency', 'issued_at', 'paid_at',
    ];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'issued_at' => 'datetime', 'paid_at' => 'datetime'];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return BelongsTo<Subscription, $this> */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
