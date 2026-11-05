<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\PublicBooking\Services\PublicBookingService;

/**
 * Endpoints públicos (sem sessão): contexto da página de reservas por slug.
 */
final class PublicBookingController extends Controller
{
    public function __construct(private readonly PublicBookingService $publicBooking) {}

    public function context(string $slug): JsonResponse
    {
        $organization = $this->publicBooking->resolveEnabledOrganization($slug);

        return response()->json(['data' => $this->publicBooking->context($organization)]);
    }
}
