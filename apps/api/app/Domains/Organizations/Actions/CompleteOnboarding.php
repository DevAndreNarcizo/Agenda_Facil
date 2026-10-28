<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Actions;

use App\Domains\Audit\Audit;
use App\Domains\Billing\Services\TrialService;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CompleteOnboarding
{
    /** Provisiona uma única organização por autocadastro e preserva seu owner. @author André Narcizo */
    public function execute(User $user, array $input): Organization
    {
        return DB::transaction(function () use ($user, $input): Organization {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $existing = Membership::where('user_id', $user->id)->where('status', 'active')->first();
            if ($existing) {
                abort_unless($existing->role === 'owner', 403, 'Apenas o proprietário conclui o onboarding.');

                return Organization::findOrFail($existing->organization_id);
            }
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['slug:'.$input['slug']]);
            if (Organization::where('slug', $input['slug'])->exists()) {
                throw ValidationException::withMessages(['slug' => 'Endereço indisponível.']);
            }
            $organization = new Organization(array_intersect_key($input, array_flip(['name', 'slug', 'timezone'])));
            $organization->settings = self::mergeProfileSettings($input);
            $organization->owner_id = $user->id;
            $organization->onboarding_completed_at = now();
            $organization->save();
            Membership::create(['organization_id' => $organization->id, 'user_id' => $user->id, 'role' => 'owner', 'status' => 'active']);
            $hours = $input['business_hours'] ?? array_map(fn (int $day): array => ['day_of_week' => $day, 'start_time' => '09:00', 'end_time' => '18:00', 'is_active' => $day >= 1 && $day <= 5], range(0, 6));
            foreach ($hours as $hour) {
                DB::table('business_hours')->insert(['organization_id' => $organization->id, ...array_intersect_key($hour, array_flip(['day_of_week', 'start_time', 'end_time', 'is_active']))]);
            }
            if (isset($input['initial_service'])) {
                $service = new Service(array_intersect_key($input['initial_service'], array_flip(['name', 'duration_minutes', 'price_cents', 'category'])));
                $service->organization_id = $organization->id;
                $service->save();
            }
            app(TrialService::class)->start($organization->id);
            Audit::record($organization->id, $user->id, 'organization.provisioned', $organization->id);

            return $organization->refresh();
        }, 3);
    }

    /** Persiste somente perfil/endereço permitidos, conservando demais settings nas atualizações. @author André Narcizo */
    public static function mergeProfileSettings(array $input, array $settings = []): array
    {
        $settings = array_replace($settings, array_intersect_key($input['profile'] ?? [], array_flip(['specialty', 'instagram', 'bio'])));
        if (array_key_exists('address', $input)) {
            $address = is_array($settings['address'] ?? null) ? $settings['address'] : [];
            $settings['address'] = array_replace($address, array_intersect_key($input['address'], array_flip(['postal_code', 'street', 'number', 'city', 'state'])));
        }

        return $settings;
    }
}
