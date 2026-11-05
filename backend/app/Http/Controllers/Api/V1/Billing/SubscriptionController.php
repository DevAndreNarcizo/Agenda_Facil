<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\CheckoutService;
use Modules\Billing\Services\EntitlementService;
use Modules\Billing\Services\SubscriptionService;
use Modules\Organizations\Services\TenantContext;

/**
 * Administração da assinatura pela organização. Apenas o owner administra (policy no servidor).
 */
final class SubscriptionController extends Controller
{
    public function __construct(
        private readonly TenantContext $tenant,
        private readonly SubscriptionService $subscriptions,
        private readonly EntitlementService $entitlements,
    ) {}

    public function show(): JsonResponse
    {
        $organization = $this->tenant->organization();
        $subscription = $organization->liveSubscription;
        $version = $subscription?->planVersion;

        return response()->json([
            'subscription' => $subscription ? [
                'status' => $subscription->status->value,
                'grants_paid_access' => $subscription->grantsPaidAccess(),
                'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
                'current_period_end' => $subscription->current_period_end?->toIso8601String(),
                'cancel_at_period_end' => $subscription->cancel_at_period_end,
                'plan' => $version ? [
                    'code' => $version->plan->code,
                    'name' => $version->plan->name,
                    'price_cents' => $version->price_cents,
                ] : null,
            ] : null,
            'usage' => [
                'professionals_limit' => $this->entitlements->limitFor($organization, EntitlementService::PROFESSIONALS),
                'monthly_appointments_limit' => $this->entitlements->limitFor($organization, EntitlementService::MONTHLY_APPOINTMENTS),
                'monthly_appointments_used' => $this->entitlements->currentUsage($organization, EntitlementService::MONTHLY_APPOINTMENTS),
            ],
        ]);
    }

    public function checkout(Request $request, CheckoutService $checkout): JsonResponse
    {
        $this->authorizeOwner();

        $data = $request->validate([
            'plan_code' => ['required', 'string', 'exists:plans,code'],
        ]);

        $session = $checkout->start(
            $this->tenant->organization(),
            $data['plan_code'],
            $this->tenant->user()->email,
        );

        return response()->json(['url' => $session->url]);
    }

    public function changePlan(Request $request): JsonResponse
    {
        $this->authorizeOwner();

        $data = $request->validate([
            'plan_code' => ['required', 'string', 'exists:plans,code'],
        ]);

        $organization = $this->tenant->organization();
        $subscription = $organization->liveSubscription;

        if ($subscription === null) {
            return response()->json(['message' => 'Nenhuma assinatura ativa para alterar.'], 409);
        }

        $target = Plan::query()->where('code', $data['plan_code'])->firstOrFail()->currentVersion;

        $updated = $this->subscriptions->changePlan($subscription, $target, $this->tenant->user()->id);

        return response()->json(['status' => $updated->status->value, 'plan_code' => $data['plan_code']]);
    }

    public function cancel(Request $request): JsonResponse
    {
        $this->authorizeOwner();

        $atPeriodEnd = (bool) $request->boolean('at_period_end', true);
        $organization = $this->tenant->organization();
        $subscription = $organization->liveSubscription;

        if ($subscription === null) {
            return response()->json(['message' => 'Nenhuma assinatura ativa.'], 409);
        }

        $updated = $this->subscriptions->cancel($subscription, $atPeriodEnd, $this->tenant->user()->id);

        return response()->json([
            'status' => $updated->status->value,
            'cancel_at_period_end' => $updated->cancel_at_period_end,
        ]);
    }

    /**
     * Apenas o proprietário administra a assinatura (autorização no servidor).
     */
    private function authorizeOwner(): void
    {
        if (! $this->tenant->membership()->role->isOwner()) {
            abort(403, 'Apenas o proprietário pode administrar a assinatura.');
        }
    }
}
