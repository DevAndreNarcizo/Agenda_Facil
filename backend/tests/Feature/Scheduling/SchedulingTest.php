<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\SubscriptionService;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Professionals\Models\Professional;
use Modules\Scheduling\DataObjects\BookingRequest;
use Modules\Scheduling\Enums\AppointmentStatus;
use Modules\Scheduling\Exceptions\SchedulingConflictException;
use Modules\Scheduling\Services\SchedulingService;

uses(RefreshDatabase::class);

/**
 * Prova as regras críticas de agenda (SPEC-004): anti-overlap, remarcação e cotas.
 */
beforeEach(function (): void {
    $this->seed(PlanCatalogSeeder::class);
    $this->scheduling = app(SchedulingService::class);
    $subscriptions = app(SubscriptionService::class);

    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $this->organization = Organization::query()->where('owner_id', $user->id)->firstOrFail();

    // Plano Pro: agendamentos ilimitados (foco nas regras de conflito).
    $pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;
    $sub = $subscriptions->startCheckout($this->organization, $pro, 'fake');
    $subscriptions->activateFromConfirmedPayment($sub, now(), now()->addMonth());
    $this->organization->refresh();

    $this->prof = Professional::create([
        'organization_id' => $this->organization->id, 'name' => 'Profa. Ana', 'is_active' => true,
    ]);
});

function req(Organization $org, string $profId, string $start, string $end): BookingRequest
{
    return new BookingRequest(
        serviceId: null, professionalId: $profId, customerId: null,
        start: Carbon::parse($start), end: Carbon::parse($end),
    );
}

it('cria agendamento quando não há conflito', function (): void {
    $appt = $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));

    expect($appt->status)->toBe(AppointmentStatus::Pending)
        ->and($appt->professional_id)->toBe($this->prof->id);
});

it('bloqueia agendamento sobreposto para o mesmo profissional', function (): void {
    $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));

    // Sobreposição parcial (09:30–10:30).
    expect(fn () => $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:30', '2026-12-01 10:30')))
        ->toThrow(SchedulingConflictException::class);
});

it('permite horários adjacentes sem sobreposição', function (): void {
    $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));
    $next = $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 10:00', '2026-12-01 11:00'));

    expect($next->start_time->format('H:i'))->toBe('10:00');
});

it('permite mesmo horário para profissionais diferentes', function (): void {
    $prof2 = Professional::create(['organization_id' => $this->organization->id, 'name' => 'Prof. Beto', 'is_active' => true]);

    $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));
    $other = $this->scheduling->book($this->organization, req($this->organization, $prof2->id, '2026-12-01 09:00', '2026-12-01 10:00'));

    expect($other->professional_id)->toBe($prof2->id);
});

it('ignora agendamento cancelado ao verificar conflito', function (): void {
    $first = $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));
    $this->scheduling->changeStatus($first, AppointmentStatus::Cancelled);

    // Mesmo horário agora é permitido.
    $again = $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));
    expect($again->id)->not->toBe($first->id);
});

it('detecta conflito ao remarcar sobre outro agendamento', function (): void {
    $a = $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 09:00', '2026-12-01 10:00'));
    $b = $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 11:00', '2026-12-01 12:00'));

    expect(fn () => $this->scheduling->reschedule($b, Carbon::parse('2026-12-01 09:30'), Carbon::parse('2026-12-01 10:30')))
        ->toThrow(SchedulingConflictException::class);

    // Remarcar para horário livre funciona.
    $moved = $this->scheduling->reschedule($b, Carbon::parse('2026-12-01 14:00'), Carbon::parse('2026-12-01 15:00'));
    expect($moved->start_time->format('H:i'))->toBe('14:00');
});

it('rejeita intervalo inválido (fim <= início)', function (): void {
    expect(fn () => $this->scheduling->book($this->organization, req($this->organization, $this->prof->id, '2026-12-01 10:00', '2026-12-01 09:00')))
        ->toThrow(SchedulingConflictException::class);
});
