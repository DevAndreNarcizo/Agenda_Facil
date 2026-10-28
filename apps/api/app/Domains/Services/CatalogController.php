<?php

declare(strict_types=1);

namespace App\Domains\Services;

use App\Domains\Audit\Audit;
use App\Domains\Billing\Services\EntitlementService;
use App\Domains\Customers\Models\Customer;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Services\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class CatalogController
{
    private function model(string $resource): string
    {
        return match ($resource) {
            'services' => Service::class, 'professionals' => Professional::class, 'customers' => Customer::class
        };
    }

    public function index(Request $request, string $resource): JsonResponse
    {
        return response()->json(['data' => $this->model($resource)::where('organization_id', $request->attributes->get('organization')->id)->orderBy('name')->limit(500)->get()]);
    }

    /** Impede atribuição de tenant, papel e campos de cobrança em CRUD genérico. @author André Narcizo */
    public function store(Request $request, string $resource): JsonResponse
    {
        $this->authorizeWrite($request, $resource);
        $organizationId = $request->attributes->get('organization')->id;
        $model = DB::transaction(function () use ($request, $resource, $organizationId) {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organizationId]);
            $input = $request->validate($this->rules($resource, $organizationId));
            if ($resource === 'professionals') {
                app(EntitlementService::class)->assertCanCreate($organizationId, 'professionals');
            }
            $model = new ($this->model($resource))($input);
            $model->organization_id = $organizationId;
            $model->save();
            if ($resource === 'professionals') {
                app(EntitlementService::class)->consume($organizationId, 'professionals');
            }
            Audit::record($organizationId, $request->user()->id, $resource.'.created', $model->id);

            return $model;
        });

        return response()->json(['data' => $model], 201);
    }

    public function update(Request $request, string $resource, string $id): JsonResponse
    {
        $this->authorizeWrite($request, $resource);
        $organizationId = $request->attributes->get('organization')->id;
        $model = DB::transaction(function () use ($request, $resource, $id, $organizationId) {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organizationId]);
            $model = $this->model($resource)::where('organization_id', $organizationId)->lockForUpdate()->findOrFail($id);
            if ($resource !== 'customers') {
                Gate::authorize('update', $model);
            }
            $model->update($request->validate($this->rules($resource, $organizationId, true, $model->id)));
            Audit::record($organizationId, $request->user()->id, $resource.'.updated', $model->id);

            return $model;
        }, 3);

        return response()->json(['data' => $model]);
    }

    public function destroy(Request $request, string $resource, string $id): JsonResponse
    {
        $model = $this->model($resource)::where('organization_id', $request->attributes->get('organization')->id)->findOrFail($id);
        Gate::authorize('delete', $model);
        if ($resource === 'customers') {
            abort_if(DB::table('appointments')->where('customer_id', $model->id)->exists(), 409, 'Cliente possui histórico de agendamentos; preserve o cadastro.');
            $model->delete();
        } else {
            $model->update(['is_active' => false]);
        }

        return response()->json(['data' => null]);
    }

    private function authorizeWrite(Request $request, string $resource): void
    {
        abort_unless($resource === 'customers' || in_array($request->attributes->get('membership')->role, ['owner', 'admin'], true), 403);
    }

    private function rules(string $resource, string $organizationId, bool $partial = false, ?string $currentId = null): array
    {
        $required = $partial ? 'sometimes|required' : 'required';
        $rules = ['name' => $required.'|string|min:2|max:120', 'organization_id' => 'prohibited', 'owner_id' => 'prohibited', 'role' => 'prohibited'];
        if ($resource === 'services') {
            $rules += ['duration_minutes' => $required.'|integer|between:5,480', 'price_cents' => $required.'|integer|min:0|max:100000000', 'category' => 'nullable|string|max:80'];
        }
        if ($resource === 'professionals') {
            $rules += ['membership_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('memberships', 'id')->where('organization_id', $organizationId)->where('status', 'active'), Rule::unique('professionals', 'membership_id')->ignore($currentId)]];
        }
        if ($resource === 'customers') {
            $rules += ['email' => 'nullable|email:rfc|max:255', 'phone' => 'nullable|string|regex:/^\+?[0-9 ()-]{10,30}$/'];
        }

        return $rules;
    }
}
