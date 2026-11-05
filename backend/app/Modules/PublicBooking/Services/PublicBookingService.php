<?php

declare(strict_types=1);

namespace Modules\PublicBooking\Services;

use Illuminate\Support\Carbon;
use Modules\Organizations\Models\Organization;
use Modules\Professionals\Models\Professional;
use Modules\PublicBooking\Exceptions\PublicBookingUnavailableException;
use Modules\PublicBooking\Models\PublicBookingSettings;
use Modules\Scheduling\DataObjects\BookingRequest;
use Modules\Scheduling\Models\Appointment;
use Modules\Scheduling\Services\SchedulingService;
use Modules\Services\Models\Service;

/**
 * Reserva pública por link (slug). Expõe apenas o necessário e cria o agendamento
 * reutilizando o SchedulingService (anti-overlap + cota). Não expõe dados de outras orgs.
 */
final class PublicBookingService
{
    public function __construct(private readonly SchedulingService $scheduling) {}

    /**
     * Resolve a organização pública pelo slug, se a reserva pública estiver habilitada.
     */
    public function resolveEnabledOrganization(string $slug): Organization
    {
        /** @var Organization|null $organization */
        $organization = Organization::query()->where('slug', $slug)->first();

        if ($organization === null) {
            throw new PublicBookingUnavailableException('Página de reservas não encontrada.');
        }

        $settings = PublicBookingSettings::query()->find($organization->id);
        if ($settings === null || ! $settings->is_enabled) {
            throw new PublicBookingUnavailableException('Reservas públicas indisponíveis.');
        }

        return $organization;
    }

    /**
     * Contexto público: serviços e profissionais permitidos (respeitando a allowlist).
     *
     * @return array{organization: array{name:string, slug:string}, services: list<array<string,mixed>>, professionals: list<array<string,mixed>>}
     */
    public function context(Organization $organization): array
    {
        $settings = PublicBookingSettings::query()->findOrFail($organization->id);

        $services = Service::query()
            ->where('organization_id', $organization->id)
            ->where('is_active', true)
            ->when(is_array($settings->allowed_service_ids), fn ($q) => $q->whereIn('id', $settings->allowed_service_ids))
            ->orderBy('name')
            ->get(['id', 'name', 'duration_minutes', 'price_cents']);

        $professionals = Professional::query()
            ->where('organization_id', $organization->id)
            ->where('is_active', true)
            ->when(is_array($settings->allowed_professional_ids), fn ($q) => $q->whereIn('id', $settings->allowed_professional_ids))
            ->orderBy('name')
            ->get(['id', 'name']);

        return [
            'organization' => ['name' => $organization->name, 'slug' => $organization->slug],
            'services' => $services->toArray(),
            'professionals' => $professionals->toArray(),
        ];
    }

    /**
     * Cria a reserva pública exigindo que o cliente esteja autenticado no portal
     * (customerId resolvido pela sessão opaca — nunca enviado livremente).
     */
    public function create(
        Organization $organization,
        string $customerId,
        string $serviceId,
        string $professionalId,
        Carbon $start,
    ): Appointment {
        $settings = PublicBookingSettings::query()->findOrFail($organization->id);

        $service = Service::query()
            ->where('organization_id', $organization->id)
            ->where('is_active', true)
            ->when(is_array($settings->allowed_service_ids), fn ($q) => $q->whereIn('id', $settings->allowed_service_ids))
            ->whereKey($serviceId)
            ->first();

        $professional = Professional::query()
            ->where('organization_id', $organization->id)
            ->where('is_active', true)
            ->when(is_array($settings->allowed_professional_ids), fn ($q) => $q->whereIn('id', $settings->allowed_professional_ids))
            ->whereKey($professionalId)
            ->first();

        if ($service === null || $professional === null) {
            throw new PublicBookingUnavailableException('Serviço ou profissional indisponível.');
        }

        $end = $start->copy()->addMinutes($service->duration_minutes);

        return $this->scheduling->book($organization, new BookingRequest(
            serviceId: $service->id,
            professionalId: $professional->id,
            customerId: $customerId,
            start: $start,
            end: $end,
            source: 'site',
        ));
    }
}
