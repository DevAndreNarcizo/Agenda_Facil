<?php

declare(strict_types=1);

namespace Modules\PublicBooking\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organizations\Models\Organization;

class PublicBookingSettings extends Model
{
    protected $primaryKey = 'organization_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'organization_id', 'is_enabled', 'allowed_service_ids', 'allowed_professional_ids',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'allowed_service_ids' => 'array',
            'allowed_professional_ids' => 'array',
        ];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
