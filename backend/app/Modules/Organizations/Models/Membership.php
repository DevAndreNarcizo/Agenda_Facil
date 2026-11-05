<?php

declare(strict_types=1);

namespace Modules\Organizations\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organizations\Enums\Role;

/**
 * Vínculo de um usuário a uma organização, com papel explícito. A autoridade de papel
 * vive no servidor: nenhuma alteração de tenant/owner/role vem do navegador.
 */
class Membership extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'user_id', 'role', 'invited_at', 'accepted_at', 'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'invited_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }
}
