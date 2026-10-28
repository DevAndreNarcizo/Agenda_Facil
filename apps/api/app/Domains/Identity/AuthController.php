<?php

declare(strict_types=1);

namespace App\Domains\Identity;

use App\Domains\Billing\Services\SubscriptionService;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

final class AuthController
{
    /** Cadastra identidade sem aceitar papéis ou vínculos do navegador. @author André Narcizo */
    public function register(Request $request): JsonResponse
    {
        $request->merge(['email' => strtolower((string) $request->input('email'))]);
        $input = $request->validate(['name' => 'required|string|min:2|max:120', 'email' => 'required|email:rfc|max:255|unique:users,email', 'password' => ['required', 'confirmed', Password::min(12)], 'organization_id' => 'prohibited', 'owner_id' => 'prohibited', 'role' => 'prohibited']);
        $input['email'] = strtolower($input['email']);
        $user = User::create($input);
        Auth::login($user);
        $request->session()->regenerate();

        return $this->user($request)->setStatusCode(201);
    }

    /** Autentica e substitui a sessão anterior para impedir fixation. @author André Narcizo */
    public function login(Request $request): JsonResponse
    {
        $input = $request->validate(['email' => 'required|email', 'password' => 'required|string', 'remember' => 'sometimes|boolean']);
        if (! Auth::attempt(['email' => strtolower($input['email']), 'password' => $input['password']], (bool) ($input['remember'] ?? false))) {
            throw ValidationException::withMessages(['email' => 'Credenciais inválidas.']);
        }
        $request->session()->regenerate();
        $request->session()->forget('organization_id');

        return $this->user($request);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Auth::forgetGuards();

        return response()->json(['data' => null]);
    }

    /** Resposta uniforme evita confirmar a existência de uma conta. @author André Narcizo */
    public function forgotPassword(Request $request): JsonResponse
    {
        $input = $request->validate(['email' => 'required|email:rfc|max:255']);
        PasswordBroker::sendResetLink(['email' => strtolower($input['email'])]);

        return response()->json(['data' => ['message' => 'Se a conta existir, enviaremos instruções para redefinir sua senha.']]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $input = $request->validate(['email' => 'required|email:rfc', 'token' => 'required|string', 'password' => ['required', 'confirmed', Password::min(12)]]);
        $status = PasswordBroker::reset($input, function (User $user, string $password): void {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });
        if ($status !== PasswordBroker::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'Link inválido ou expirado.']);
        }
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Auth::forgetGuards();

        return response()->json(['data' => ['message' => 'Senha redefinida. Entre novamente.']]);
    }

    /** Resolve o contexto somente por membership ativa do usuário autenticado. @author André Narcizo */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        $memberships = Membership::where('user_id', $user->id)->where('status', 'active');
        $membership = $request->session()->has('organization_id')
            ? (clone $memberships)->where('organization_id', $request->session()->get('organization_id'))->first()
            : $memberships->orderBy('created_at')->first();
        $organization = $membership ? Organization::find($membership->organization_id) : null;
        if ($organization) {
            $request->session()->put('organization_id', $organization->id);
        } else {
            $request->session()->forget('organization_id');
        }

        return response()->json(['data' => ['user' => $user->only(['id', 'name', 'email']), 'organization' => $organization, 'membership' => $membership?->only(['id', 'role']), 'subscription' => $organization ? app(SubscriptionService::class)->summary($organization->id) : null]]);
    }
}
