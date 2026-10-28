<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ResolveTenant
{
    /** Deriva tenant da sessão e revalida membership em cada request. @author André Narcizo */
    public function handle(Request $request, Closure $next): Response
    {
        $membership = Membership::query()->where('user_id', $request->user()->id)->where('status', 'active')->where('organization_id', $request->session()->get('organization_id'))->first();
        abort_unless($membership, 403, 'Conclua o onboarding ou solicite acesso à organização.');
        $request->attributes->set('membership', $membership);
        $request->attributes->set('organization', Organization::findOrFail($membership->organization_id));

        return $next($request);
    }
}
