<?php

declare(strict_types=1);

namespace Modules\Customers\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organizations\Models\Organization;

class Customer extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'name', 'phone', 'phone_normalized', 'email', 'notes',
    ];

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Normaliza o telefone (apenas dígitos) para busca/dedupe consistentes.
     */
    public static function normalizePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $digits = preg_replace('/\D/', '', $phone) ?? '';

        return $digits !== '' ? $digits : null;
    }
}
