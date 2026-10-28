<?php

declare(strict_types=1);

namespace App\Domains\Memberships\Policies;

use App\Domains\Memberships\Models\Membership;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

final class TenantResourcePolicy
{
    /** A autorização sempre inclui tenant e membership ativa. @author André Narcizo */
    public function update(User $user, Model $resource): bool
    {
        return Membership::query()->where('user_id', $user->id)->where('organization_id', $resource->organization_id)->where('status', 'active')->whereIn('role', ['owner', 'admin'])->exists();
    }

    public function delete(User $user, Model $resource): bool
    {
        return $this->update($user, $resource);
    }
}
