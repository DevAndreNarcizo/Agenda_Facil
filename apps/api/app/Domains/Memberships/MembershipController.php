<?php

declare(strict_types=1);

namespace App\Domains\Memberships;

use App\Domains\Audit\Audit;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MembershipController
{
    public function index(Request $request): JsonResponse
    {
        $this->manager($request);

        $memberships = DB::table('memberships')->join('users', 'users.id', '=', 'memberships.user_id')
            ->where('memberships.organization_id', $request->attributes->get('organization')->id)->orderBy('users.name')
            ->get(['memberships.id', 'memberships.organization_id', 'memberships.user_id', 'memberships.role', 'memberships.status', 'memberships.created_at', 'memberships.updated_at', 'users.name', 'users.email']);

        return response()->json(['data' => $memberships]);
    }

    public function invitations(Request $request): JsonResponse
    {
        $this->manager($request);
        $invitations = DB::table('membership_invitations')->where('organization_id', $request->attributes->get('organization')->id)
            ->orderByDesc('created_at')->limit(500)->get(['id', 'email', 'role', 'expires_at', 'accepted_at', 'revoked_at', 'created_at'])
            ->map(function (object $invitation): array {
                return [
                    'id' => $invitation->id, 'email' => $invitation->email, 'role' => $invitation->role,
                    'expires_at' => CarbonImmutable::parse($invitation->expires_at)->toIso8601String(),
                    'accepted_at' => $invitation->accepted_at ? CarbonImmutable::parse($invitation->accepted_at)->toIso8601String() : null,
                    'revoked_at' => $invitation->revoked_at ? CarbonImmutable::parse($invitation->revoked_at)->toIso8601String() : null,
                    'created_at' => CarbonImmutable::parse($invitation->created_at)->toIso8601String(),
                    'status' => $this->invitationStatus($invitation),
                ];
            });

        return response()->json(['data' => $invitations]);
    }

    /** Convite com segredo de uso único; entrega externa depende de provedor homologado. @author André Narcizo */
    public function invite(Request $request): JsonResponse
    {
        $this->manager($request);
        $input = $request->validate(['email' => 'required|email:rfc|max:255', 'role' => 'required|in:admin,employee', 'organization_id' => 'prohibited', 'owner_id' => 'prohibited', 'user_id' => 'prohibited']);
        $input['email'] = strtolower($input['email']);
        $key = $request->header('Idempotency-Key');
        abort_if($key !== null && ! preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key), 422, 'Chave de idempotência inválida.');
        $hash = hash('sha256', json_encode(['email' => $input['email'], 'role' => $input['role']], JSON_THROW_ON_ERROR));
        [$invitation, $token] = DB::transaction(function () use ($request, $input, $key, $hash): array {
            $organization = $request->attributes->get('organization');
            Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $this->lockedManager($request);
            if ($key !== null) {
                $previous = DB::table('membership_invitations')->where('organization_id', $organization->id)->where('idempotency_key', $key)->lockForUpdate()->first();
                if ($previous) {
                    abort_unless($previous->request_hash && hash_equals($previous->request_hash, $hash), 409, 'Chave já usada para outro convite.');

                    return [$previous, null];
                }
            }
            abort_if(DB::table('memberships')->join('users', 'users.id', '=', 'memberships.user_id')->where('memberships.organization_id', $organization->id)->where('memberships.status', 'active')->whereRaw('lower(users.email) = ?', [$input['email']])->exists(), 409, 'Este email já possui acesso ativo à organização.');
            $pending = DB::table('membership_invitations')->where('organization_id', $organization->id)->where('email', $input['email'])->whereNull('accepted_at')->whereNull('revoked_at')->orderByDesc('expires_at')->lockForUpdate()->first();
            if ($pending && CarbonImmutable::parse($pending->expires_at)->isFuture()) {
                abort_unless($pending->role === $input['role'], 409, 'Revogue o convite pendente antes de mudar o papel.');

                return [$pending, null];
            }
            if ($pending) {
                DB::table('membership_invitations')->where('id', $pending->id)->update(['revoked_at' => now(), 'updated_at' => now()]);
            }
            $token = Str::random(64);
            $id = (string) Str::uuid();
            DB::table('membership_invitations')->insert(['id' => $id, 'organization_id' => $organization->id, 'email' => $input['email'], 'role' => $input['role'], 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(3), 'idempotency_key' => $key, 'request_hash' => $hash, 'created_at' => now(), 'updated_at' => now()]);
            Audit::record($organization->id, $request->user()->id, 'membership.invited', $id);

            return [DB::table('membership_invitations')->where('id', $id)->first(), $token];
        }, 3);

        return response()->json(['data' => ['id' => $invitation->id, 'invitation_token' => $token, 'expires_at' => CarbonImmutable::parse($invitation->expires_at)->toIso8601String(), 'delivery' => 'manual', 'already_pending' => $token === null && $this->invitationStatus($invitation) === 'pending', 'status' => $this->invitationStatus($invitation)]], $token === null ? 200 : 201);
    }

    /** Revoga apenas o convite pendente do tenant; reexecução não altera o histórico. @author André Narcizo */
    public function revokeInvitation(Request $request, string $id): JsonResponse
    {
        $this->manager($request);
        DB::transaction(function () use ($request, $id): void {
            $organization = $request->attributes->get('organization');
            Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $this->lockedManager($request);
            $invitation = DB::table('membership_invitations')->where('organization_id', $organization->id)->where('id', $id)->lockForUpdate()->first();
            abort_unless($invitation, 404);
            abort_if($invitation->accepted_at !== null, 409, 'O convite já foi aceito. Revogue a membership se necessário.');
            if ($invitation->revoked_at === null) {
                DB::table('membership_invitations')->where('id', $id)->update(['revoked_at' => now(), 'updated_at' => now()]);
                Audit::record($organization->id, $request->user()->id, 'membership.invitation_revoked', $id);
            }
        }, 3);

        return response()->json(['data' => null]);
    }

    public function accept(Request $request): JsonResponse
    {
        $input = $request->validate(['token' => 'required|string|size:64', 'organization_id' => 'prohibited', 'owner_id' => 'prohibited', 'role' => 'prohibited', 'user_id' => 'prohibited']);
        $membership = DB::transaction(function () use ($request, $input) {
            $candidate = DB::table('membership_invitations')->where('token_hash', hash('sha256', $input['token']))->first(['id', 'organization_id']);
            abort_unless($candidate, 404);
            Organization::whereKey($candidate->organization_id)->lockForUpdate()->firstOrFail();
            $invite = DB::table('membership_invitations')->where('id', $candidate->id)->where('organization_id', $candidate->organization_id)->whereNull('revoked_at')->whereNull('accepted_at')->where('expires_at', '>', now())->lockForUpdate()->first();
            abort_unless($invite && hash_equals($invite->email, strtolower($request->user()->email)), 404);
            $membership = Membership::firstOrNew(['organization_id' => $invite->organization_id, 'user_id' => $request->user()->id]);
            abort_if($membership->exists && $membership->status === 'active', 409, 'Membership já ativa.');
            $membership->fill(['role' => $invite->role, 'status' => 'active'])->save();
            DB::table('membership_invitations')->where('id', $invite->id)->update(['accepted_at' => now()]);
            Audit::record($invite->organization_id, $request->user()->id, 'membership.accepted', $membership->id);

            return $membership;
        }, 3);
        $request->session()->put('organization_id', $membership->organization_id);

        return response()->json(['data' => $membership]);
    }

    /** Revogação serializada impede perda do último owner e troca implícita de proprietário. @author André Narcizo */
    public function revoke(Request $request, string $id): JsonResponse
    {
        $this->manager($request);
        $organization = $request->attributes->get('organization');
        DB::transaction(function () use ($request, $organization, $id): void {
            Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $actor = Membership::where('organization_id', $organization->id)->where('user_id', $request->user()->id)->where('status', 'active')->lockForUpdate()->first();
            abort_unless($actor && in_array($actor->role, ['owner', 'admin'], true), 403);
            $membership = Membership::where('organization_id', $organization->id)->lockForUpdate()->findOrFail($id);
            if ($membership->role === 'owner') {
                abort_unless($actor->role === 'owner', 403);
                abort_if(Membership::where('organization_id', $organization->id)->where('role', 'owner')->where('status', 'active')->count() <= 1 || $organization->owner_id === $membership->user_id, 409, 'Transfira a propriedade antes de remover este owner.');
            }
            $membership->update(['status' => 'revoked']);
            Audit::record($organization->id, $request->user()->id, 'membership.revoked', $membership->id);
        });

        return response()->json(['data' => null]);
    }

    public function transfer(Request $request): JsonResponse
    {
        abort_unless($request->attributes->get('membership')->role === 'owner', 403);
        $input = $request->validate(['membership_id' => 'required|uuid', 'organization_id' => 'prohibited', 'owner_id' => 'prohibited', 'role' => 'prohibited', 'user_id' => 'prohibited']);
        $organization = $request->attributes->get('organization');
        DB::transaction(function () use ($request, $input, $organization): void {
            $locked = Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $actor = Membership::where('organization_id', $organization->id)->where('user_id', $request->user()->id)->where('status', 'active')->lockForUpdate()->first();
            abort_unless($actor && $actor->role === 'owner', 403);
            $target = Membership::where('organization_id', $organization->id)->where('status', 'active')->lockForUpdate()->findOrFail($input['membership_id']);
            abort_if($target->user_id === $request->user()->id, 422, 'Escolha outro membro ativo.');
            $target->update(['role' => 'owner']);
            $locked->owner_id = $target->user_id;
            $locked->save();
            $actor->update(['role' => 'admin']);
            Audit::record($organization->id, $request->user()->id, 'ownership.transferred', $target->id);
        });

        return response()->json(['data' => ['transferred' => true]]);
    }

    private function manager(Request $request): void
    {
        abort_unless(in_array($request->attributes->get('membership')->role, ['owner', 'admin'], true), 403);
    }

    private function lockedManager(Request $request): void
    {
        $actor = Membership::where('organization_id', $request->attributes->get('organization')->id)->where('user_id', $request->user()->id)->where('status', 'active')->lockForUpdate()->first();
        abort_unless($actor && in_array($actor->role, ['owner', 'admin'], true), 403);
    }

    private function invitationStatus(object $invitation): string
    {
        return $invitation->accepted_at ? 'accepted' : ($invitation->revoked_at ? 'revoked' : (CarbonImmutable::parse($invitation->expires_at)->isPast() ? 'expired' : 'pending'));
    }
}
