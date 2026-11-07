<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organizations\Services\TenantContext;
use Modules\Services\Models\Service;

/**
 * Serviços da organização. Escrita restrita a gestores (owner/admin).
 */
final class ServiceController extends Controller
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function index(): JsonResponse
    {
        $services = Service::query()
            ->where('organization_id', $this->tenant->organization()->id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $services]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManager();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:80'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'price_cents' => ['nullable', 'integer', 'min:0'],
        ]);

        $service = Service::create([
            'organization_id' => $this->tenant->organization()->id,
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'duration_minutes' => $data['duration_minutes'],
            'price_cents' => $data['price_cents'] ?? 0,
        ]);

        return response()->json(['data' => $service], 201);
    }

    public function update(Request $request, string $service): JsonResponse
    {
        $this->authorizeManager();

        $model = Service::query()
            ->where('organization_id', $this->tenant->organization()->id)
            ->whereKey($service)
            ->firstOrFail();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:80'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'price_cents' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $model->update($data);

        return response()->json(['data' => $model]);
    }

    private function authorizeManager(): void
    {
        if (! $this->tenant->membership()->role->isManager()) {
            abort(403, 'Apenas proprietário ou administrador pode gerenciar serviços.');
        }
    }
}
