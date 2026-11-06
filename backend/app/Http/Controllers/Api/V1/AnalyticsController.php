<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Modules\Analytics\Services\AnalyticsService;
use Modules\Organizations\Services\TenantContext;

/**
 * Analytics do painel. Escopado ao tenant resolvido pelo servidor.
 */
final class AnalyticsController extends Controller
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function summary(Request $request, AnalyticsService $analytics): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : null;
        $to = isset($data['to']) ? Carbon::parse($data['to'])->endOfDay() : null;

        return response()->json(['data' => $analytics->summary($this->tenant->organization(), $from, $to)]);
    }
}
