<?php

declare(strict_types=1);

namespace Modules\Organizations\Services;

use Illuminate\Support\Facades\DB;
use Modules\Organizations\Models\BusinessHour;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Models\OrganizationSettings;
use Modules\Services\Models\Service;

/**
 * Onboarding transacional e idempotente (ADR equivalente ao complete_onboarding do Supabase):
 * define identidade do negócio, horários de funcionamento e o primeiro serviço, e marca a
 * conclusão. Reexecutável apenas pelo owner (autorização no controller).
 */
final class OnboardingService
{
    /**
     * @param  array{
     *   business_name:string, slug?:?string, specialty?:?string, segment?:?string,
     *   address?:?array<string,mixed>,
     *   schedule: list<array{day_of_week:int, start:string, end:string, active:bool}>,
     *   first_service: array{name:string, duration_minutes:int, price_cents?:int, category?:?string}
     * }  $payload
     */
    public function complete(Organization $organization, array $payload): Organization
    {
        return DB::transaction(function () use ($organization, $payload): Organization {
            $organization->update([
                'name' => $payload['business_name'],
                'onboarding_completed_at' => now(),
            ]);

            OrganizationSettings::updateOrCreate(
                ['organization_id' => $organization->id],
                [
                    'specialty' => $payload['specialty'] ?? null,
                    'segment' => $payload['segment'] ?? null,
                    'address' => $payload['address'] ?? null,
                ],
            );

            // Horários (0..6): substitui o conjunto atual.
            BusinessHour::query()->where('organization_id', $organization->id)->delete();
            foreach ($payload['schedule'] as $entry) {
                BusinessHour::create([
                    'organization_id' => $organization->id,
                    'day_of_week' => $entry['day_of_week'],
                    'start_time' => $entry['start'],
                    'end_time' => $entry['end'],
                    'is_active' => $entry['active'],
                ]);
            }

            // Primeiro serviço (idempotente por nome dentro da organização).
            $service = $payload['first_service'];
            Service::updateOrCreate(
                ['organization_id' => $organization->id, 'name' => $service['name']],
                [
                    'duration_minutes' => $service['duration_minutes'],
                    'price_cents' => $service['price_cents'] ?? 0,
                    'category' => $service['category'] ?? null,
                    'is_active' => true,
                ],
            );

            return $organization->refresh();
        });
    }
}
