<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Modules\CustomerPortal\Services\PortalAuthService;
use Modules\PublicBooking\Services\PublicBookingService;

/**
 * Portal do cliente: OTP (request/verify) e reserva autenticada por sessão opaca.
 * O slug identifica a organização; o cliente é resolvido pela sessão (nunca do corpo).
 */
final class PortalController extends Controller
{
    public function __construct(
        private readonly PortalAuthService $portalAuth,
        private readonly PublicBookingService $publicBooking,
    ) {}

    public function requestOtp(Request $request, string $slug): JsonResponse
    {
        $organization = $this->publicBooking->resolveEnabledOrganization($slug);
        $data = $request->validate(['phone' => ['required', 'string', 'max:20']]);

        $result = $this->portalAuth->requestOtp($organization->id, $data['phone'], (string) $request->ip());

        // Resposta genérica (anti-enumeração). debug_code só em dev/test.
        $payload = ['message' => 'Se o telefone estiver cadastrado, enviaremos um código.'];
        if ($result->debugCode !== null) {
            $payload['debug_code'] = $result->debugCode;
        }

        return response()->json($payload, 202);
    }

    public function verifyOtp(Request $request, string $slug): JsonResponse
    {
        $organization = $this->publicBooking->resolveEnabledOrganization($slug);
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:20'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        try {
            $session = $this->portalAuth->verifyOtp($organization->id, $data['phone'], $data['code']);
        } catch (\RuntimeException) {
            return response()->json(['message' => 'Código inválido ou expirado.'], 422);
        }

        return response()->json([
            'token' => $session->token,
            'expires_at' => $session->expiresAt,
        ]);
    }

    public function createBooking(Request $request, string $slug): JsonResponse
    {
        $organization = $this->publicBooking->resolveEnabledOrganization($slug);

        $session = $this->portalAuth->resolveSession($organization->id, $request->header('X-Portal-Session'));
        if ($session === null) {
            return response()->json(['message' => 'Sessão do portal inválida.'], 401);
        }

        $data = $request->validate([
            'service_id' => ['required', 'uuid'],
            'professional_id' => ['required', 'uuid'],
            'start_time' => ['required', 'date'],
        ]);

        $appointment = $this->publicBooking->create(
            $organization,
            $session->customer_id,
            $data['service_id'],
            $data['professional_id'],
            Carbon::parse($data['start_time']),
        );

        return response()->json(['data' => [
            'id' => $appointment->id,
            'status' => $appointment->status->value,
            'start_time' => $appointment->start_time->toIso8601String(),
            'end_time' => $appointment->end_time->toIso8601String(),
        ]], 201);
    }
}
