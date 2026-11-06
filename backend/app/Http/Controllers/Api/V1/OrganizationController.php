<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organizations\Models\BusinessHour;
use Modules\Organizations\Services\OnboardingService;
use Modules\Organizations\Services\TenantContext;

/**
 * Organização: estado de onboarding, conclusão do onboarding e horários de funcionamento.
 */
final class OrganizationController extends Controller
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function show(): JsonResponse
    {
        $org = $this->tenant->organization();

        return response()->json(['data' => [
            'id' => $org->id,
            'name' => $org->name,
            'slug' => $org->slug,
            'primary_color' => $org->primary_color,
            'logo_url' => $org->logo_url,
            'onboarding_completed' => $org->onboarding_completed_at !== null,
            'business_hours' => BusinessHour::query()
                ->where('organization_id', $org->id)
                ->orderBy('day_of_week')
                ->get(['day_of_week', 'start_time', 'end_time', 'is_active']),
        ]]);
    }

    public function update(Request $request): JsonResponse
    {
        if (! $this->tenant->membership()->role->isManager()) {
            abort(403, 'Apenas proprietário ou administrador pode alterar a identidade.');
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'primary_color' => ['sometimes', 'nullable', 'regex:/^#([0-9a-fA-F]{6})$/'],
            'logo_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
        ]);

        $org = $this->tenant->organization();
        $org->update($data);

        return response()->json(['data' => [
            'id' => $org->id,
            'name' => $org->name,
            'primary_color' => $org->primary_color,
            'logo_url' => $org->logo_url,
        ]]);
    }

    public function completeOnboarding(Request $request, OnboardingService $onboarding): JsonResponse
    {
        if (! $this->tenant->membership()->role->isOwner()) {
            abort(403, 'Apenas o proprietário conclui o onboarding.');
        }

        $data = $request->validate([
            'business_name' => ['required', 'string', 'max:120'],
            'specialty' => ['nullable', 'string', 'max:120'],
            'segment' => ['nullable', 'in:estetica,beleza,cabelo,pet'],
            'address' => ['nullable', 'array'],
            'schedule' => ['required', 'array', 'size:7'],
            'schedule.*.day_of_week' => ['required', 'integer', 'between:0,6'],
            'schedule.*.start' => ['required', 'date_format:H:i'],
            'schedule.*.end' => ['required', 'date_format:H:i', 'after:schedule.*.start'],
            'schedule.*.active' => ['required', 'boolean'],
            'first_service' => ['required', 'array'],
            'first_service.name' => ['required', 'string', 'max:120'],
            'first_service.duration_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'first_service.price_cents' => ['nullable', 'integer', 'min:0'],
            'first_service.category' => ['nullable', 'string', 'max:80'],
        ]);

        $org = $onboarding->complete($this->tenant->organization(), $data);

        return response()->json(['data' => [
            'onboarding_completed' => $org->onboarding_completed_at !== null,
        ]]);
    }
}
