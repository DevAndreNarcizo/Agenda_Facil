<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    use HasUuids;

    protected $guarded = ['id', 'owner_id', 'logo_file_id'];

    protected $appends = ['logo_url'];

    /** Só publica o logo selecionado pelo gestor quando a reserva pública está habilitada. @author André Narcizo */
    protected function logoUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->logo_file_id && $this->public_booking_enabled
            ? '/api/v1/public/'.$this->slug.'/logo'
            : null);
    }

    protected function casts(): array
    {
        return ['settings' => 'array', 'public_booking_enabled' => 'boolean', 'onboarding_completed_at' => 'datetime'];
    }
}
