<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Organizations\Models\Membership;
use Modules\Organizations\Services\TenantContext;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolve o tenant (organização) a partir do usuário autenticado e do membership ativo —
 * NUNCA de um parâmetro enviado livremente pelo navegador (AUDIT §Segurança / missão §5).
 *
 * A organização alvo pode ser indicada por rota/cabeçalho, mas o acesso só é concedido se
 * o usuário tiver membership ativo nela. Sem isso, 403.
 */
final class ResolveTenantContext
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            abort(401, 'Não autenticado.');
        }

        // Organização solicitada (rota > cabeçalho). Opcional: cai no membership único.
        $requestedOrgId = $request->route('organization')
            ?? $request->header('X-Organization-Id');

        $query = Membership::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at');

        if (is_string($requestedOrgId) && $requestedOrgId !== '') {
            $query->where('organization_id', $requestedOrgId);
        }

        $memberships = $query->with('organization')->get();

        if ($memberships->isEmpty()) {
            abort(403, 'Sem acesso a esta organização.');
        }

        if ($memberships->count() > 1) {
            // Ambíguo: exige que o cliente especifique a organização.
            abort(409, 'Especifique a organização (X-Organization-Id).');
        }

        $membership = $memberships->first();

        $this->context->set($membership->organization, $membership, $user);

        return $next($request);
    }
}
