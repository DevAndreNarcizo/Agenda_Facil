<?php

declare(strict_types=1);

namespace Modules\Operations\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Billing\Enums\SubscriptionStatus;
use Modules\Billing\Models\Plan;

/**
 * Migração reversível Supabase -> PostgreSQL próprio (Fase C / ADR-013).
 *
 * Transforma um dump lógico do Supabase (tabelas no modelo legado) para o modelo canônico
 * do Laravel, PRESERVANDO IDs/UUID e relacionamentos. É copy-forward: não toca a origem.
 *
 * Mapeamentos principais (ver src/lib/database.types.ts):
 *  - services.price (reais) -> services.price_cents (centavos)
 *  - profiles (owner/admin/employee) -> users + memberships; employees viram professionals
 *  - appointments.employee_id (profiles) -> professional_id (professionals)
 *  - organizations.{plan_name,subscription_status,stripe_*,trial_end} -> subscriptions + billing_customers
 *
 * ponytail: processa o dump em memória, em transação única. Teto: datasets muito grandes;
 * para volumes de produção, fatiar por organização. Aqui preserva integridade e reversibilidade.
 */
final class SupabaseMigrationService
{
    /**
     * @param  array<string, list<array<string, mixed>>>  $dump  tabelas do Supabase
     * @param  array{password_placeholder?:string}  $options
     * @return array<string, int> contagens inseridas por tabela canônica
     */
    public function migrate(array $dump, array $options = []): array
    {
        $passwordPlaceholder = $options['password_placeholder'] ?? null; // null = senha nula (exige redefinição)

        return DB::transaction(function () use ($dump, $passwordPlaceholder): array {
            $inserted = [];

            // Mapa auxiliar: id do profile -> role, para distinguir professionals (employees).
            $profiles = $dump['profiles'] ?? [];

            // 1) users (a partir de profiles). Senha nula por padrão: hashes do GoTrue não
            //    são presumidos compatíveis -> fluxo de redefinição no primeiro acesso.
            $users = array_map(fn (array $p) => [
                'id' => $p['id'],
                'name' => $p['full_name'] ?? 'Usuário',
                'email' => isset($p['email']) ? strtolower((string) $p['email']) : $this->placeholderEmail($p['id']),
                'phone' => $p['phone'] ?? null,
                'password' => $passwordPlaceholder,
                'created_at' => $this->ts($p['created_at'] ?? null),
                'updated_at' => $this->ts($p['updated_at'] ?? null),
            ], $profiles);
            $inserted['users'] = $this->insertChunked('users', $this->dedupeBy($users, 'email'));

            // 2) organizations (sem campos de assinatura — vão para subscriptions).
            $orgs = array_map(fn (array $o) => [
                'id' => $o['id'],
                'name' => $o['name'],
                'slug' => $o['slug'],
                'owner_id' => $o['owner_id'] ?? null,
                'logo_url' => $o['logo_url'] ?? null,
                'primary_color' => $o['primary_color'] ?? null,
                'onboarding_completed_at' => $this->ts($o['onboarding_completed_at'] ?? null),
                'created_at' => $this->ts($o['created_at'] ?? null),
                'updated_at' => $this->ts($o['updated_at'] ?? null),
            ], $dump['organizations'] ?? []);
            $inserted['organizations'] = $this->insertChunked('organizations', $orgs);

            // 3) organization_settings
            $settings = array_map(fn (array $s) => [
                'organization_id' => $s['organization_id'],
                'specialty' => $s['specialty'] ?? null,
                'segment' => $s['segment'] ?? null,
                'instagram' => $s['instagram'] ?? null,
                'bio' => $s['bio'] ?? null,
                'address' => isset($s['address']) ? $this->jsonOrNull($s['address']) : null,
                'timezone' => $s['timezone'] ?? 'America/Sao_Paulo',
                'created_at' => $this->ts($s['created_at'] ?? null),
                'updated_at' => $this->ts($s['updated_at'] ?? null),
            ], $dump['organization_settings'] ?? []);
            $inserted['organization_settings'] = $this->insertChunked('organization_settings', $settings);

            // 4) memberships (a partir de profiles com organization_id).
            $memberships = [];
            $professionals = [];
            foreach ($profiles as $p) {
                if (empty($p['organization_id'])) {
                    continue;
                }
                $role = $this->mapRole((string) ($p['role'] ?? 'employee'));
                $memberships[] = [
                    'id' => (string) Str::uuid(),
                    'organization_id' => $p['organization_id'],
                    'user_id' => $p['id'],
                    'role' => $role,
                    'accepted_at' => $this->ts($p['created_at'] ?? null) ?? now(),
                    'created_at' => $this->ts($p['created_at'] ?? null),
                    'updated_at' => $this->ts($p['updated_at'] ?? null),
                ];
                // employees/staff também viram profissionais que atendem (preserva id do profile).
                if (in_array($role, ['employee', 'owner', 'admin'], true)) {
                    $professionals[] = [
                        'id' => $p['id'], // preserva o id do profile como professional
                        'organization_id' => $p['organization_id'],
                        'user_id' => $p['id'],
                        'name' => $p['full_name'] ?? 'Profissional',
                        'is_active' => true,
                        'created_at' => $this->ts($p['created_at'] ?? null),
                        'updated_at' => $this->ts($p['updated_at'] ?? null),
                    ];
                }
            }
            $inserted['memberships'] = $this->insertChunked('memberships', $memberships);

            // 5) services (price reais -> price_cents).
            $services = array_map(fn (array $s) => [
                'id' => $s['id'],
                'organization_id' => $s['organization_id'],
                'name' => $s['name'],
                'category' => $s['category'] ?? null,
                'duration_minutes' => (int) ($s['duration_minutes'] ?? 30),
                'price_cents' => (int) round(((float) ($s['price'] ?? 0)) * 100),
                'is_active' => (bool) ($s['is_active'] ?? true),
                'created_at' => $this->ts($s['created_at'] ?? null),
                'updated_at' => $this->ts($s['created_at'] ?? null),
            ], $dump['services'] ?? []);
            $inserted['services'] = $this->insertChunked('services', $services);

            $inserted['professionals'] = $this->insertChunked('professionals', $professionals);

            // 6) customers
            $customers = array_map(fn (array $c) => [
                'id' => $c['id'],
                'organization_id' => $c['organization_id'],
                'name' => $c['name'],
                'phone' => $c['phone'] ?? null,
                'phone_normalized' => $c['phone_normalized'] ?? $this->normalizePhone($c['phone'] ?? null),
                'email' => $c['email'] ?? null,
                'created_at' => $this->ts($c['created_at'] ?? null),
                'updated_at' => $this->ts($c['updated_at'] ?? null),
            ], $dump['customers'] ?? []);
            $inserted['customers'] = $this->insertChunked('customers', $customers);

            // 7) appointments (employee_id -> professional_id).
            $appointments = array_map(fn (array $a) => [
                'id' => $a['id'],
                'organization_id' => $a['organization_id'],
                'service_id' => $a['service_id'] ?? null,
                'professional_id' => $a['employee_id'] ?? null,
                'customer_id' => $a['customer_id'] ?? null,
                'start_time' => $this->ts($a['start_time']),
                'end_time' => $this->ts($a['end_time']),
                'status' => $this->mapAppointmentStatus((string) ($a['status'] ?? 'pending')),
                'booking_source' => $a['booking_source'] ?? 'direct',
                'is_blocked' => (bool) ($a['is_blocked'] ?? false),
                'reminder_sent_at' => $this->ts($a['reminder_sent_at'] ?? null),
                'created_at' => $this->ts($a['created_at'] ?? null),
                'updated_at' => $this->ts($a['created_at'] ?? null),
            ], $dump['appointments'] ?? []);
            $inserted['appointments'] = $this->insertChunked('appointments', $appointments);

            // 8) business_hours (de organization_business_hours).
            $hours = array_map(fn (array $h) => [
                'id' => (string) Str::uuid(),
                'organization_id' => $h['organization_id'],
                'day_of_week' => (int) $h['day_of_week'],
                'start_time' => $h['start_time'],
                'end_time' => $h['end_time'],
                'is_active' => (bool) ($h['is_active'] ?? true),
                'created_at' => now(),
                'updated_at' => now(),
            ], $dump['organization_business_hours'] ?? []);
            $inserted['business_hours'] = $this->insertChunked('business_hours', $hours);

            // 9) billing: subscriptions + billing_customers a partir de organizations.
            $inserted = array_merge($inserted, $this->migrateBilling($dump['organizations'] ?? []));

            return $inserted;
        });
    }

    /**
     * Deriva assinaturas e clientes de billing dos campos inline das organizations.
     *
     * @param  list<array<string, mixed>>  $orgs
     * @return array<string, int>
     */
    private function migrateBilling(array $orgs): array
    {
        $planVersionByCode = [];
        foreach (Plan::query()->with('currentVersion')->get() as $plan) {
            $planVersionByCode[$plan->code] = $plan->currentVersion?->id;
        }

        $subscriptions = [];
        $billingCustomers = [];

        foreach ($orgs as $o) {
            $planCode = strtolower((string) ($o['plan_name'] ?? 'starter'));
            $planVersionId = $planVersionByCode[$planCode] ?? $planVersionByCode['starter'] ?? null;
            if ($planVersionId === null) {
                continue; // catálogo de planos precisa estar semeado antes
            }

            $status = SubscriptionStatus::fromGateway((string) ($o['subscription_status'] ?? 'trialing'));

            $subscriptions[] = [
                'id' => (string) Str::uuid(),
                'organization_id' => $o['id'],
                'plan_version_id' => $planVersionId,
                'gateway' => $o['stripe_subscription_id'] ?? null ? 'stripe' : null,
                'gateway_subscription_id' => $o['stripe_subscription_id'] ?? null,
                'status' => $status->value,
                'trial_used' => ! empty($o['trial_end']),
                'trial_ends_at' => $this->ts($o['trial_end'] ?? null),
                'cancel_at_period_end' => false,
                'created_at' => $this->ts($o['created_at'] ?? null),
                'updated_at' => $this->ts($o['updated_at'] ?? null),
            ];

            if (! empty($o['stripe_customer_id'])) {
                $billingCustomers[] = [
                    'id' => (string) Str::uuid(),
                    'organization_id' => $o['id'],
                    'gateway' => 'stripe',
                    'gateway_customer_id' => $o['stripe_customer_id'],
                    'created_at' => $this->ts($o['created_at'] ?? null),
                    'updated_at' => $this->ts($o['updated_at'] ?? null),
                ];
            }
        }

        return [
            'subscriptions' => $this->insertChunked('subscriptions', $subscriptions),
            'billing_customers' => $this->insertChunked('billing_customers', $billingCustomers),
        ];
    }

    private function mapRole(string $role): string
    {
        return match (strtolower($role)) {
            'owner' => 'owner',
            'admin' => 'admin',
            default => 'employee', // employee/staff
        };
    }

    private function mapAppointmentStatus(string $status): string
    {
        return match (strtolower($status)) {
            'confirmed' => 'confirmed',
            'completed' => 'completed',
            'cancelled', 'canceled' => 'cancelled',
            default => 'pending',
        };
    }

    private function normalizePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        return $digits !== '' ? $digits : null;
    }

    private function placeholderEmail(string $id): string
    {
        return 'migrado+'.$id.'@agendafacil.local';
    }

    private function ts(mixed $value): ?string
    {
        if (is_string($value) && $value !== '') {
            return Carbon::parse($value)->toDateTimeString();
        }

        return null;
    }

    private function jsonOrNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return is_string($value) ? $value : json_encode($value, JSON_THROW_ON_ERROR);
    }

    /**
     * Remove duplicatas por uma chave (ex.: email) mantendo a primeira ocorrência.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function dedupeBy(array $rows, string $key): array
    {
        $seen = [];
        $out = [];
        foreach ($rows as $row) {
            $v = $row[$key] ?? null;
            if ($v !== null && isset($seen[$v])) {
                continue;
            }
            if ($v !== null) {
                $seen[$v] = true;
            }
            $out[] = $row;
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function insertChunked(string $table, array $rows): int
    {
        $count = 0;
        foreach (array_chunk($rows, 500) as $chunk) {
            if ($chunk !== []) {
                DB::table($table)->insert($chunk);
                $count += count($chunk);
            }
        }

        return $count;
    }
}
