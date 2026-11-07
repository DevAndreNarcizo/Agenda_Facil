<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Organizations\Services\TenantContext;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guard de assinatura: restringe operações PAGAS quando a assinatura não concede acesso
 * (suspensa/cancelada/incompleta). Preserva acesso limitado a exportação, regularização e
 * administração — estas rotas NÃO usam este middleware (missão §7).
 */
final class EnsureSubscriptionIsUsable
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $organization = $this->context->organization();
        $subscription = $organization->liveSubscription;

        if ($subscription === null || ! $subscription->grantsPaidAccess()) {
            abort(402, 'Assinatura inativa. Regularize o pagamento para continuar usando este recurso.');
        }

        return $next($request);
    }
}
