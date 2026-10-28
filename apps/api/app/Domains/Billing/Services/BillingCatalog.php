<?php

declare(strict_types=1);

namespace App\Domains\Billing\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class BillingCatalog
{
    /** Fixtures explicitamente sintéticas, nunca ativadas em produção. @author André Narcizo */
    public function ensureLocalFixtures(): void
    {
        if (! app()->environment(['local', 'testing']) || ! config('billing.local_fixtures')) {
            return;
        }
        DB::transaction(function (): void {
            // Espelha o catálogo React existente; não cria uma nova política comercial.
            foreach (['starter' => ['Starter', 3900, 1, 100, 0], 'pro' => ['Pro', 6900, 5, null, 1], 'clinic' => ['Clínica', 9900, null, null, 1]] as $code => [$name, $price, $professionals, $appointments, $premium]) {
                DB::table('plans')->insertOrIgnore(['id' => (string) Str::uuid(), 'code' => $code, 'name' => $name.' — demonstração', 'is_synthetic' => true, 'created_at' => now(), 'updated_at' => now()]);
                $plan = DB::table('plans')->where('code', $code)->first();
                DB::table('plan_versions')->insertOrIgnore(['id' => (string) Str::uuid(), 'plan_id' => $plan->id, 'version' => 2, 'price_cents' => $price, 'currency' => 'BRL', 'interval' => 'monthly', 'trial_days' => 14, 'created_at' => now(), 'updated_at' => now()]);
                $version = DB::table('plan_versions')->where('plan_id', $plan->id)->where('version', 2)->first();
                foreach (['professionals' => $professionals, 'appointments' => $appointments, 'messages' => 0, 'premium' => $premium, 'settings' => 1] as $resource => $limit) {
                    DB::table('plan_entitlements')->insertOrIgnore(['id' => (string) Str::uuid(), 'plan_version_id' => $version->id, 'resource' => $resource, 'limit_value' => $limit]);
                }
            }
        });
    }

    public function version(string $code): object
    {
        $this->ensureLocalFixtures();
        $version = DB::table('plan_versions')->join('plans', 'plans.id', '=', 'plan_versions.plan_id')
            ->where('plans.code', $code)->where('plans.is_active', true)->where('plan_versions.is_active', true)
            ->when(! app()->environment(['local', 'testing']), fn ($q) => $q->where('plans.is_synthetic', false))
            ->select('plan_versions.*')->orderByDesc('version')->first();
        abort_unless($version, 422, 'Plano indisponível.');

        return $version;
    }

    public function plans(): array
    {
        $this->ensureLocalFixtures();

        return DB::table('plans')->where('is_active', true)
            ->when(! app()->environment(['local', 'testing']), fn ($q) => $q->where('is_synthetic', false))
            ->get()->map(function ($plan): array {
                $version = $this->version($plan->code);

                return ['id' => $plan->id, 'code' => $plan->code, 'name' => $plan->name, 'synthetic' => $plan->is_synthetic, 'version_id' => $version->id, 'price_cents' => $version->price_cents, 'currency' => $version->currency, 'interval' => $version->interval, 'trial_days' => $version->trial_days, 'entitlements' => DB::table('plan_entitlements')->where('plan_version_id', $version->id)->pluck('limit_value', 'resource')->all()];
            })->all();
    }
}
