<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Modules\Customers\Models\Customer;
use Modules\Notifications\Channels\FakeNotificationChannel;
use Modules\Notifications\Contracts\NotificationChannel;
use Modules\Notifications\DataObjects\SendResult;
use Modules\Notifications\Models\MessageDelivery;
use Modules\Notifications\Services\ReminderService;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Professionals\Models\Professional;
use Modules\Scheduling\Models\Appointment;

uses(RefreshDatabase::class);

/**
 * Prova o outbox de lembretes (SPEC-005): idempotência, lease, backoff, confirmado-only.
 */
beforeEach(function (): void {
    $this->seed(PlanCatalogSeeder::class);
    $this->channel = new FakeNotificationChannel;
    app()->instance(NotificationChannel::class, $this->channel);
    $this->service = app(ReminderService::class);

    $owner = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $this->org = $owner->memberships()->firstOrFail()->organization;
    $this->prof = Professional::create(['organization_id' => $this->org->id, 'name' => 'Ana', 'is_active' => true]);
    $this->customer = Customer::create([
        'organization_id' => $this->org->id, 'name' => 'Cliente', 'phone' => '11999990000',
        'phone_normalized' => '11999990000',
    ]);
});

function confirmedApptIn(Organization $org, string $profId, string $customerId, Carbon $start): Appointment
{
    return Appointment::create([
        'organization_id' => $org->id,
        'professional_id' => $profId,
        'customer_id' => $customerId,
        'start_time' => $start,
        'end_time' => $start->copy()->addHour(),
        'status' => 'confirmed',
    ]);
}

it('enfileira lembrete para agendamento confirmado na janela 24-25h', function (): void {
    $now = Carbon::parse('2026-12-01 10:00:00');
    confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(24)->addMinutes(30));

    $queued = $this->service->queueDueReminders($now);

    expect($queued)->toBe(1)
        ->and(MessageDelivery::query()->count())->toBe(1);
});

it('não enfileira fora da janela nem duplicado (idempotência)', function (): void {
    $now = Carbon::parse('2026-12-01 10:00:00');
    // Fora da janela (daqui 2h).
    confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(2));
    expect($this->service->queueDueReminders($now))->toBe(0);

    // Na janela, enfileira uma vez; segunda chamada não duplica.
    confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(24)->addMinutes(10));
    expect($this->service->queueDueReminders($now))->toBe(1)
        ->and($this->service->queueDueReminders($now))->toBe(0)
        ->and(MessageDelivery::query()->count())->toBe(1);
});

it('envia o lembrete e marca reminder_sent_at', function (): void {
    $now = Carbon::parse('2026-12-01 10:00:00');
    $appt = confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(24)->addMinutes(30));
    $this->service->queueDueReminders($now);

    $summary = $this->service->processDue($now);

    expect($summary['sent'])->toBe(1)
        ->and($this->channel->sent)->toHaveCount(1)
        ->and($this->channel->sent[0]->recipientPhone)->toBe('11999990000')
        ->and($appt->fresh()->reminder_sent_at)->not->toBeNull()
        ->and(MessageDelivery::query()->first()->status)->toBe('sent');
});

it('pula quando o agendamento não está mais confirmado', function (): void {
    $now = Carbon::parse('2026-12-01 10:00:00');
    $appt = confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(24)->addMinutes(30));
    $this->service->queueDueReminders($now);

    // Cliente cancela antes do envio.
    $appt->update(['status' => 'cancelled']);

    $summary = $this->service->processDue($now);

    expect($summary['sent'])->toBe(0)
        ->and($summary['skipped'])->toBe(1)
        ->and($this->channel->sent)->toHaveCount(0)
        ->and(MessageDelivery::query()->first()->status)->toBe('skipped');
});

it('aplica backoff em falha transitória sem esgotar tentativas', function (): void {
    $now = Carbon::parse('2026-12-01 10:00:00');
    confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(24)->addMinutes(30));
    $this->service->queueDueReminders($now);

    $this->channel->nextResult = SendResult::failed('whatsapp_503', retriable: true);
    $summary = $this->service->processDue($now);

    $delivery = MessageDelivery::query()->first();
    expect($summary['failed'])->toBe(1)
        ->and($delivery->status)->toBe('failed')
        ->and($delivery->attempts)->toBe(1)
        ->and($delivery->next_attempt_at->greaterThan($now))->toBeTrue(); // reagendado (backoff)
});

it('não envia duas vezes o mesmo lembrete em execuções seguidas', function (): void {
    $now = Carbon::parse('2026-12-01 10:00:00');
    confirmedApptIn($this->org, $this->prof->id, $this->customer->id, $now->copy()->addHours(24)->addMinutes(30));
    $this->service->queueDueReminders($now);

    $this->service->processDue($now);          // envia
    $again = $this->service->processDue($now);  // nada a reivindicar

    expect($again['claimed'])->toBe(0)
        ->and($this->channel->sent)->toHaveCount(1);
});
