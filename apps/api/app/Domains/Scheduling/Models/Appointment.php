<?php

declare(strict_types=1);

namespace App\Domains\Scheduling\Models;

use App\Domains\Customers\Models\Customer;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Services\Models\Service;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    use HasUuids;

    public ?string $issuedCancellationToken = null;

    protected $guarded = ['id'];

    protected $hidden = ['cancellation_token_hash', 'request_hash', 'idempotency_key'];

    protected function casts(): array
    {
        return ['start_time' => 'immutable_datetime', 'end_time' => 'immutable_datetime', 'price_cents' => 'integer'];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
