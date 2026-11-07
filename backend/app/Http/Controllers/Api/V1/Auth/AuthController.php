<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Modules\Organizations\Services\ProvisioningService;

/**
 * Autenticação da SPA Angular via Sanctum. Controllers finos — regra fica nos serviços.
 */
final class AuthController extends Controller
{
    public function register(Request $request, ProvisioningService $provisioning): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'org_name' => ['required', 'string', 'max:120'],
            'org_slug' => ['required', 'string', 'min:3', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'segment' => ['nullable', 'in:estetica,beleza,cabelo,pet'],
        ]);

        $user = $provisioning->registerOwner($data);
        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', strtolower($credentials['email']))->first();

        if ($user === null || $user->password === null || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Credenciais inválidas.'],
            ]);
        }

        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            'memberships' => $user->memberships()->whereNull('revoked_at')->with('organization:id,name,slug')->get()
                ->map(fn ($m) => [
                    'organization_id' => $m->organization_id,
                    'role' => $m->role,
                    'organization' => $m->organization ? ['id' => $m->organization->id, 'name' => $m->organization->name, 'slug' => $m->organization->slug] : null,
                ]),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }
}
