<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Billing\Models\Plan;

/**
 * Catálogo de planos servido pelo backend — fonte autoritativa (corrige planos no frontend).
 */
final class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = Plan::query()
            ->where('is_active', true)
            ->with(['currentVersion.entitlements'])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => $plans->map(function (Plan $plan): array {
                $version = $plan->currentVersion;

                return [
                    'code' => $plan->code,
                    'name' => $plan->name,
                    'subtitle' => $plan->subtitle,
                    'price_cents' => $version?->price_cents,
                    'currency' => $version?->currency,
                    'billing_interval' => $version?->billing_interval,
                    'entitlements' => $version
                        ? $version->entitlements->mapWithKeys(fn ($e) => [
                            $e->key => $e->value_bool !== null ? $e->value_bool : $e->value_int,
                        ])
                        : [],
                ];
            }),
        ]);
    }
}
