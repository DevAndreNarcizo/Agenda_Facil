<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\SubscriptionService;
use Modules\Customers\Models\Customer;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Professionals\Models\Professional;
use Modules\PublicBooking\Models\PublicBookingSettings;
use Modules\Scheduling\DataObjects\BookingRequest;
use Modules\Scheduling\Services\SchedulingService;
use Modules\Services\Models\Service;

/**
 * Dados SINTÉTICOS para staging/demonstração do piloto. Não usar em produção.
 * Cria uma organização de demonstração com assinatura ativa, equipe, serviços,
 * clientes e alguns agendamentos. Idempotente pelo slug.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlanCatalogSeeder::class);

        if (Organization::query()->where('slug', 'studio-demo')->exists()) {
            $this->command?->info('Demo já existe (studio-demo). Nada a fazer.');

            return;
        }

        $owner = app(ProvisioningService::class)->registerOwner([
            'full_name' => 'Marina Demo',
            'email' => 'demo@agendafacil.example',
            'password' => 'demo-staging-123',
            'org_name' => 'Studio Demo',
            'org_slug' => 'studio-demo',
            'segment' => 'estetica',
        ]);
        $org = $owner->memberships()->firstOrFail()->organization;

        // Assinatura Pro ativa (demonstra cotas sem bloquear operação).
        $pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;
        $subs = app(SubscriptionService::class);
        $subs->activateFromConfirmedPayment(
            $subs->startCheckout($org, $pro, 'fake'),
            Carbon::now(),
            Carbon::now()->addMonth(),
        );

        $services = collect([
            ['name' => 'Limpeza de pele', 'duration_minutes' => 60, 'price_cents' => 12000],
            ['name' => 'Design de sobrancelha', 'duration_minutes' => 30, 'price_cents' => 5000],
            ['name' => 'Massagem relaxante', 'duration_minutes' => 90, 'price_cents' => 18000],
        ])->map(fn (array $s) => Service::create([...$s, 'organization_id' => $org->id, 'is_active' => true]));

        // Habilita reserva pública (todos os serviços/profissionais) para demonstração.
        PublicBookingSettings::create([
            'organization_id' => $org->id,
            'is_enabled' => true,
            'allowed_service_ids' => null,
            'allowed_professional_ids' => null,
        ]);

        $professionals = collect(['Ana Paula', 'Beatriz Lima'])
            ->map(fn (string $name) => Professional::create([
                'organization_id' => $org->id, 'name' => $name, 'is_active' => true,
            ]));

        // Cliente de demonstração com telefone DETERMINÍSTICO (usado no fluxo de reserva pública/OTP).
        $customers = collect([
            ['name' => 'João Souza', 'phone' => '11988887777'],
            ['name' => 'Carla Mendes', 'phone' => '11977776666'],
            ['name' => 'Pedro Alves', 'phone' => '11966665555'],
        ])->map(fn (array $c) => Customer::create([
            'organization_id' => $org->id, 'name' => $c['name'],
            'phone' => $c['phone'], 'phone_normalized' => Customer::normalizePhone($c['phone']),
        ]));

        // Alguns agendamentos amanhã, sem sobreposição (horários distintos).
        $scheduling = app(SchedulingService::class);
        $base = Carbon::tomorrow()->setHour(9);
        foreach ($customers as $i => $customer) {
            $start = $base->copy()->addHours($i * 2);
            $service = $services[$i % $services->count()];
            $scheduling->book($org, new BookingRequest(
                serviceId: $service->id,
                professionalId: $professionals[$i % $professionals->count()]->id,
                customerId: $customer->id,
                start: $start,
                end: $start->copy()->addMinutes($service->duration_minutes),
                source: 'direct',
            ));
        }

        $this->command?->info('Demo criada: studio-demo (login demo@agendafacil.example).');
    }
}
