<?php

declare(strict_types=1);

namespace Modules\Billing\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasUuids;

    protected $fillable = [
        'invoice_id', 'organization_id', 'gateway', 'gateway_payment_id',
        'method', 'status', 'amount_cents', 'currency', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'confirmed_at' => 'datetime'];
    }

    /** @return BelongsTo<Invoice, $this> */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
