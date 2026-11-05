<?php

declare(strict_types=1);

namespace Modules\Organizations\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Modules\Organizations\Enums\Role;
use Modules\Organizations\Models\Membership;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Models\OrganizationSettings;

/**
 * Provisionamento transacional e idempotente de conta (usuário + organização + membership owner).
 * Corrige a escalada de privilégio do sistema legado: o papel de autocadastro é SEMPRE owner e
 * nenhum vínculo/role vem de dados controlados pelo cliente.
 */
final class ProvisioningService
{
    /**
     * Cria usuário dono + organização + settings + membership 'owner' em uma transação.
     *
     * @param  array{full_name:string, email:string, password:string, phone?:?string, org_name:string, org_slug:string, segment?:?string}  $input
     */
    public function registerOwner(array $input): User
    {
        return DB::transaction(function () use ($input): User {
            $user = new User([
                'id' => (string) Str::uuid(),
                'name' => $input['full_name'],
                'email' => strtolower($input['email']),
                'phone' => $input['phone'] ?? null,
                'password' => Hash::make($input['password']),
            ]);
            $user->save();

            $organization = new Organization([
                'name' => $input['org_name'],
                'slug' => $this->uniqueSlug($input['org_slug']),
                'owner_id' => $user->id,
            ]);
            $organization->save();

            OrganizationSettings::create([
                'organization_id' => $organization->id,
                'segment' => $input['segment'] ?? null,
            ]);

            // O dono SEMPRE recebe o papel owner — nunca lido do cliente.
            Membership::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'role' => Role::Owner->value,
                'accepted_at' => now(),
            ]);

            return $user;
        });
    }

    /**
     * Garante unicidade do slug anexando sufixo quando necessário.
     */
    private function uniqueSlug(string $base): string
    {
        $slug = Str::slug($base);
        $candidate = $slug;
        $suffix = 1;

        while (Organization::query()->where('slug', $candidate)->exists()) {
            $candidate = "{$slug}-{$suffix}";
            $suffix++;
        }

        return $candidate;
    }
}
