<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Billing\Models\Plan;
use Modules\Billing\Models\PlanVersion;
use Modules\Billing\Services\EntitlementService;

/**
 * Catálogo de planos como fonte no servidor (corrige "planos/preços no frontend").
 * Valores sintéticos espelhando o catálogo atual do produto (starter/pro/clinic).
 * Price IDs do gateway ficam NULOS aqui — resolvidos por ambiente/configuração.
 */
class PlanCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            [
                'code' => 'starter', 'name' => 'Starter', 'subtitle' => '1 profissional',
                'price_cents' => 3900, 'sort' => 1,
                'entitlements' => [
                    EntitlementService::PROFESSIONALS => 1,
                    EntitlementService::MONTHLY_APPOINTMENTS => 100,
                    EntitlementService::MESSAGES => 500,
                    EntitlementService::PREMIUM_REPORTS => false,
                ],
            ],
            [
                'code' => 'pro', 'name' => 'Pro', 'subtitle' => 'Até 5 profissionais',
                'price_cents' => 6900, 'sort' => 2,
                'entitlements' => [
                    EntitlementService::PROFESSIONALS => 5,
                    EntitlementService::MONTHLY_APPOINTMENTS => null, // ilimitado
                    EntitlementService::MESSAGES => 5000,
                    EntitlementService::PREMIUM_REPORTS => true,
                ],
            ],
            [
                'code' => 'clinic', 'name' => 'Clínica', 'subtitle' => 'Profissionais ilimitados',
                'price_cents' => 9900, 'sort' => 3,
                'entitlements' => [
                    EntitlementService::PROFESSIONALS => null, // ilimitado
                    EntitlementService::MONTHLY_APPOINTMENTS => null,
                    EntitlementService::MESSAGES => null,
                    EntitlementService::PREMIUM_REPORTS => true,
                ],
            ],
        ];

        foreach ($catalog as $entry) {
            $plan = Plan::query()->updateOrCreate(
                ['code' => $entry['code']],
                ['name' => $entry['name'], 'subtitle' => $entry['subtitle'], 'is_active' => true, 'sort_order' => $entry['sort']],
            );

            $version = PlanVersion::query()->updateOrCreate(
                ['plan_id' => $plan->id, 'version' => 1],
                [
                    'price_cents' => $entry['price_cents'],
                    'currency' => 'BRL',
                    'billing_interval' => 'month',
                    'gateway' => null,
                    'gateway_price_id' => null,
                    'is_current' => true,
                ],
            );

            foreach ($entry['entitlements'] as $key => $value) {
                $version->entitlements()->updateOrCreate(
                    ['key' => $key],
                    is_bool($value)
                        ? ['value_bool' => $value, 'value_int' => null]
                        : ['value_int' => $value, 'value_bool' => null],
                );
            }
        }
    }
}
