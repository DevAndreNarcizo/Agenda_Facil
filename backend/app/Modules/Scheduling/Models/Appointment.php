<?php

declare(strict_types=1);

namespace Modules\Scheduling\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Customers\Models\Customer;
use Modules\Organizations\Models\Organization;
use Modules\Professionals\Models\Professional;
use Modules\Scheduling\Enums\AppointmentStatus;
use Modules\Services\Models\Service;

class Appointment extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'service_id', 'professional_id', 'customer_id',
        'start_time', 'end_time', 'status', 'booking_source', 'is_blocked', 'reminder_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => AppointmentStatus::class,
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'is_blocked' => 'boolean',
            'reminder_sent_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return BelongsTo<Service, $this> */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    /** @return BelongsTo<Professional, $this> */
    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
