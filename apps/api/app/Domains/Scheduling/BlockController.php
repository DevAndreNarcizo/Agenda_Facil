<?php

declare(strict_types=1);

namespace App\Domains\Scheduling;

use App\Domains\Audit\Audit;
use App\Domains\Billing\Services\SubscriptionService;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class BlockController
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['start' => 'sometimes|date', 'end' => 'sometimes|date|after:start']);
        $blocks = DB::table('appointment_blocks')->where('organization_id', $request->attributes->get('organization')->id)
            ->when(isset($input['start']), fn ($q) => $q->where('end_time', '>', $input['start']))
            ->when(isset($input['end']), fn ($q) => $q->where('start_time', '<', $input['end']))
            ->orderBy('start_time')->limit(500)->get(['id', 'professional_id', 'start_time', 'end_time']);

        return response()->json(['data' => $blocks]);
    }

    /** Bloqueio e reserva compartilham lock para não permitir disputa entre tabelas. @author André Narcizo */
    public function store(Request $request, SubscriptionService $billing): JsonResponse
    {
        $input = $request->validate([
            'professional_id' => 'nullable|uuid',
            'start_time' => ['required', 'date', 'after:now', 'regex:/T.+(?:Z|[+-]\d{2}:\d{2})$/'],
            'end_time' => ['required', 'date', 'after:start_time', 'regex:/T.+(?:Z|[+-]\d{2}:\d{2})$/'],
            'organization_id' => 'prohibited',
        ]);
        $organization = $request->attributes->get('organization');
        abort_unless($billing->summary($organization->id)['has_access'] ?? false, 403, 'Regularize a assinatura antes de criar novos bloqueios.');
        $professional = $input['professional_id'] ?? null;
        $this->canManage($request, $professional);
        $start = CarbonImmutable::parse($input['start_time'])->utc();
        $end = CarbonImmutable::parse($input['end_time'])->utc();
        $block = DB::transaction(function () use ($request, $organization, $professional, $start, $end): object {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organization->id]);
            if ($professional) {
                Professional::where('organization_id', $organization->id)->where('is_active', true)->findOrFail($professional);
            }
            $existing = DB::table('appointment_blocks')->where('organization_id', $organization->id)->where('professional_id', $professional)->where('start_time', $start)->where('end_time', $end)->first();
            if ($existing) {
                return $existing;
            }
            abort_if(Appointment::where('organization_id', $organization->id)->when($professional, fn ($q) => $q->where('professional_id', $professional))
                ->whereIn('status', ['pending', 'confirmed', 'completed'])->where('start_time', '<', $end)->where('end_time', '>', $start)->exists(), 409, 'Há agendamentos neste intervalo. Reagende ou cancele antes de bloquear.');
            $id = (string) Str::uuid();
            DB::table('appointment_blocks')->insert(['id' => $id, 'organization_id' => $organization->id, 'professional_id' => $professional, 'start_time' => $start, 'end_time' => $end, 'created_at' => now(), 'updated_at' => now()]);
            Audit::record($organization->id, $request->user()->id, 'appointment_block.created', $id);

            return DB::table('appointment_blocks')->where('id', $id)->first();
        }, 3);

        return response()->json(['data' => $block], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $organization = $request->attributes->get('organization');
        DB::transaction(function () use ($request, $organization, $id): void {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organization->id]);
            $block = DB::table('appointment_blocks')->where('organization_id', $organization->id)->where('id', $id)->lockForUpdate()->first();
            abort_unless($block, 404);
            $this->canManage($request, $block->professional_id);
            DB::table('appointment_blocks')->where('id', $id)->delete();
            Audit::record($organization->id, $request->user()->id, 'appointment_block.deleted', $id);
        }, 3);

        return response()->json(['data' => null]);
    }

    private function canManage(Request $request, ?string $professionalId): void
    {
        $membership = $request->attributes->get('membership');
        if (in_array($membership->role, ['owner', 'admin'], true)) {
            return;
        }
        abort_unless($professionalId && Professional::where('organization_id', $membership->organization_id)->where('membership_id', $membership->id)->whereKey($professionalId)->where('is_active', true)->exists(), 403, 'Funcionários só podem bloquear a própria agenda.');
    }
}
