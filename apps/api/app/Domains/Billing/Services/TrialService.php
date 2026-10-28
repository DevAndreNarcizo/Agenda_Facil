<?php

declare(strict_types=1);

namespace App\Domains\Billing\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TrialService
{
    /** Provisiona uma única assinatura e um único trial por organização. @author André Narcizo */
    public function start(string $organizationId, string $planCode = 'starter'): object
    {
        return DB::transaction(function () use ($organizationId, $planCode): object {
            abort_unless(DB::table('organizations')->where('id', $organizationId)->lockForUpdate()->first(), 404);
            $existing = DB::table('subscriptions')->where('organization_id', $organizationId)->lockForUpdate()->first();
            if ($existing) {
                return $existing;
            }
            $version = app(BillingCatalog::class)->version($planCode);
            $status = $version->trial_days > 0 ? 'trialing' : 'pending';
            $id = (string) Str::uuid();
            DB::table('subscriptions')->insert(['id' => $id, 'organization_id' => $organizationId, 'plan_version_id' => $version->id, 'status' => $status, 'trial_used_at' => $status === 'trialing' ? now() : null, 'trial_ends_at' => $status === 'trialing' ? now()->addDays($version->trial_days) : null, 'created_at' => now(), 'updated_at' => now()]);
            SubscriptionService::audit($organizationId, $id, 'trial.provisioned', null, $status);

            return DB::table('subscriptions')->where('id', $id)->first();
        });
    }
}
