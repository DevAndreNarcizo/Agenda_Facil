<?php

declare(strict_types=1);

namespace App\Domains\Organizations;

use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Domains\Organizations\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class OrganizationController
{
    public function onboarding(Request $request, CompleteOnboarding $action): JsonResponse
    {
        $input = $request->validate([
            'name' => 'required|string|min:2|max:120',
            'slug' => 'required|string|min:3|max:80|regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
            'timezone' => 'sometimes|timezone:all',
            'initial_service' => 'sometimes|required|array:name,duration_minutes,price_cents,category',
            'initial_service.name' => 'required_with:initial_service|string|min:2|max:120',
            'initial_service.duration_minutes' => 'required_with:initial_service|integer|between:5,480',
            'initial_service.price_cents' => 'required_with:initial_service|integer|min:0|max:100000000',
            'initial_service.category' => 'nullable|string|max:80',
            ...$this->profileRules(), ...$this->hoursRules(), ...$this->protectedFields(),
        ]);
        $organization = $action->execute($request->user(), $input);
        $request->session()->put('organization_id', $organization->id);

        return response()->json(['data' => $organization], 201);
    }

    /** Lista apenas organizações cuja membership do ator está ativa. @author André Narcizo */
    public function index(Request $request): JsonResponse
    {
        $organizations = DB::table('memberships')->join('organizations', 'organizations.id', '=', 'memberships.organization_id')
            ->where('memberships.user_id', $request->user()->id)->where('memberships.status', 'active')
            ->orderBy('organizations.name')->get(['organizations.id', 'organizations.name', 'organizations.slug', 'organizations.timezone', 'memberships.role', 'memberships.id as membership_id']);

        return response()->json(['data' => $organizations]);
    }

    /** O UUID recebido solicita uma seleção; só a membership verificada concede o novo contexto. @author André Narcizo */
    public function activate(Request $request): JsonResponse
    {
        $input = $request->validate(['organization_id' => 'required|uuid', 'owner_id' => 'prohibited', 'role' => 'prohibited']);
        $organization = DB::transaction(function () use ($request, $input): Organization {
            $membership = Membership::where('user_id', $request->user()->id)->where('organization_id', $input['organization_id'])->where('status', 'active')->lockForUpdate()->first();
            abort_unless($membership, 403, 'Você não tem acesso ativo a esta organização.');

            return Organization::findOrFail($membership->organization_id);
        }, 3);
        $request->session()->put('organization_id', $organization->id);

        return response()->json(['data' => $organization->only(['id', 'name', 'slug', 'timezone', 'primary_color'])]);
    }

    public function settings(Request $request): JsonResponse
    {
        $organization = $request->attributes->get('organization');

        return response()->json(['data' => [...$organization->toArray(), 'business_hours' => DB::table('business_hours')->where('organization_id', $organization->id)->orderBy('day_of_week')->get()]]);
    }

    /** Atualiza somente campos administrativos autorizados e horários válidos. @author André Narcizo */
    public function update(Request $request): JsonResponse
    {
        abort_unless(in_array($request->attributes->get('membership')->role, ['owner', 'admin'], true), 403);
        $input = $request->validate(['name' => 'sometimes|required|string|min:2|max:120', 'slug' => ['sometimes', 'required', 'string', 'min:3', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('organizations', 'slug')->ignore($request->attributes->get('organization')->id)], 'timezone' => 'sometimes|timezone:all', 'primary_color' => 'sometimes|regex:/^#[0-9a-fA-F]{6}$/', 'public_booking_enabled' => 'sometimes|boolean', ...$this->profileRules(), ...$this->hoursRules(), ...$this->protectedFields()]);
        $organization = $request->attributes->get('organization');
        DB::transaction(function () use ($organization, $input): void {
            $hours = $input['business_hours'] ?? null;
            $organization->fill(array_intersect_key($input, array_flip(['name', 'slug', 'timezone', 'primary_color', 'public_booking_enabled'])));
            $organization->settings = CompleteOnboarding::mergeProfileSettings($input, $organization->settings ?? []);
            $organization->save();
            foreach ($hours ?? [] as $hour) {
                DB::table('business_hours')->updateOrInsert(['organization_id' => $organization->id, 'day_of_week' => $hour['day_of_week']], array_diff_key($hour, ['day_of_week' => true]));
            }
        });

        return $this->settings($request);
    }

    private function profileRules(): array
    {
        return [
            'profile' => 'sometimes|array:specialty,instagram,bio',
            'profile.specialty' => 'nullable|string|max:120', 'profile.instagram' => 'nullable|string|max:100', 'profile.bio' => 'nullable|string|max:2000',
            'address' => 'sometimes|array:postal_code,street,number,city,state',
            'address.postal_code' => 'nullable|string|max:20', 'address.street' => 'nullable|string|max:500',
            'address.number' => 'nullable|string|max:20', 'address.city' => 'nullable|string|max:100', 'address.state' => 'nullable|string|max:50',
        ];
    }

    private function hoursRules(): array
    {
        return [
            'business_hours' => 'sometimes|array|size:7',
            'business_hours.*' => 'required|array:day_of_week,start_time,end_time,is_active',
            'business_hours.*.day_of_week' => 'required|integer|between:0,6|distinct',
            'business_hours.*.start_time' => 'required|date_format:H:i',
            'business_hours.*.end_time' => 'required|date_format:H:i|after:business_hours.*.start_time',
            'business_hours.*.is_active' => 'required|boolean',
        ];
    }

    private function protectedFields(): array
    {
        return array_fill_keys(['organization_id', 'owner_id', 'role', 'subscription_status', 'plan_version_id', 'settings', 'logo_file_id'], 'prohibited');
    }
}
