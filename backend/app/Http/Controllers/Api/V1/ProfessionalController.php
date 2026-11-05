<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Exceptions\QuotaExceededException;
use Modules\Billing\Services\EntitlementService;
use Modules\Organizations\Services\TenantContext;
use Modules\Professionals\Models\Professional;

/**
 * Profissionais. A criação respeita a cota de profissionais do plano (enforcement no servidor).
 */
final class ProfessionalController extends Controller
{
    public function __construct(
        private readonly TenantContext $tenant,
        private readonly EntitlementService $entitlements,
    ) {}

    public function index(): JsonResponse
    {
        $professionals = Professional::query()
            ->where('organization_id', $this->tenant->organization()->id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $professionals]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManager();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'user_id' => ['nullable', 'uuid'],
        ]);

        $organization = $this->tenant->organization();

        // Cota de profissionais do plano.
        $current = Professional::query()
            ->where('organization_id', $organization->id)
            ->where('is_active', true)
            ->count();

        try {
            $this->entitlements->ensureWithinLimit($organization, EntitlementService::PROFESSIONALS, $current);
        } catch (QuotaExceededException $e) {
            return response()->json([
                'message' => 'Limite de profissionais do plano atingido. Faça upgrade para adicionar mais.',
                'entitlement' => $e->entitlementKey,
                'limit' => $e->limit,
            ], 402);
        }

        $professional = Professional::create([
            'organization_id' => $organization->id,
            'name' => $data['name'],
            'user_id' => $data['user_id'] ?? null,
        ]);

        return response()->json(['data' => $professional], 201);
    }

    private function authorizeManager(): void
    {
        if (! $this->tenant->membership()->role->isManager()) {
            abort(403, 'Apenas proprietário ou administrador pode gerenciar profissionais.');
        }
    }
}
