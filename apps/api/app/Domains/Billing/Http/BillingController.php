<?php

declare(strict_types=1);

namespace App\Domains\Billing\Http;

use App\Domains\Billing\Services\BillingCatalog;
use App\Domains\Billing\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class BillingController
{
    public function plans(BillingCatalog $catalog): JsonResponse
    {
        return response()->json(['data' => $catalog->plans()]);
    }

    public function subscription(Request $request, SubscriptionService $service): JsonResponse
    {
        return response()->json(['data' => $service->summary($this->organization($request))]);
    }

    public function invoices(Request $request): JsonResponse
    {
        $this->owner($request);

        return response()->json(['data' => DB::table('invoices')->where('organization_id', $this->organization($request))->orderByDesc('due_date')->limit(100)->get(['id', 'status', 'amount_cents', 'currency', 'due_date', 'paid_at'])]);
    }

    public function checkout(Request $request, SubscriptionService $service): JsonResponse
    {
        $this->owner($request);
        $data = $request->validate(['plan_code' => ['required', 'string', 'max:50'], 'organization_id' => ['prohibited'], 'price_cents' => ['prohibited'], 'trial_days' => ['prohibited']]);
        $key = $request->header('Idempotency-Key');
        abort_unless(is_string($key) && preg_match('/^[A-Za-z0-9_-]{16,80}$/D', $key), 422, 'Informe Idempotency-Key válido.');

        return response()->json(['data' => $service->checkout($this->organization($request), $data['plan_code'], $key)]);
    }

    public function changePlan(Request $request, SubscriptionService $service): JsonResponse
    {
        $this->owner($request);
        $data = $request->validate(['plan_code' => ['required', 'string', 'max:50'], 'price_cents' => ['prohibited'], 'organization_id' => ['prohibited']]);
        $service->changePlan($this->organization($request), $data['plan_code']);

        return response()->json(['data' => $service->summary($this->organization($request))]);
    }

    public function cancel(Request $request, SubscriptionService $service): JsonResponse
    {
        $this->owner($request);
        $data = $request->validate(['at_period_end' => ['required', 'boolean']]);
        $service->cancel($this->organization($request), $data['at_period_end']);

        return response()->json(['data' => $service->summary($this->organization($request))]);
    }

    private function organization(Request $request): string
    {
        $organization = $request->attributes->get('organization');
        abort_unless($organization, 403);

        return $organization->id;
    }

    private function owner(Request $request): void
    {
        abort_unless($request->attributes->get('membership')?->role === 'owner', 403, 'Somente o proprietário pode gerenciar cobranças.');
    }
}
