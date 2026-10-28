<?php

declare(strict_types=1);

namespace App\Domains\Organizations;

use App\Domains\Files\PrivateFileService;
use App\Domains\Organizations\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class BrandingController
{
    public function upload(Request $request, BrandingService $service): JsonResponse
    {
        $this->authorizeWrite($request);
        $request->validate([
            'file' => ['required', 'file', 'image', 'mimetypes:image/png,image/jpeg,image/webp', 'max:2048', 'dimensions:max_width=4096,max_height=4096'],
            'organization_id' => 'prohibited', 'logo_file_id' => 'prohibited', 'disk' => 'prohibited', 'path' => 'prohibited',
        ]);
        $organization = $service->replace($request->attributes->get('organization'), $request->user()->id, $request->file('file'));

        return response()->json(['data' => $organization->only(['logo_file_id', 'logo_url'])], 201);
    }

    public function clear(Request $request, BrandingService $service): JsonResponse
    {
        $this->authorizeWrite($request);
        $organization = $service->clear($request->attributes->get('organization'), $request->user()->id);

        return response()->json(['data' => $organization->only(['logo_file_id', 'logo_url'])]);
    }

    /** Não recebe ID/path livre: publica só o logo já autorizado do tenant identificado pelo slug. @author André Narcizo */
    public function publicLogo(string $slug, PrivateFileService $files): StreamedResponse
    {
        $organization = Organization::where('slug', $slug)->where('public_booking_enabled', true)->firstOrFail();
        abort_unless($organization->logo_file_id, 404);
        $record = $files->find($organization->id, $organization->logo_file_id);
        $stream = $files->stream($record);

        return response()->stream(function () use ($stream): void {
            try {
                fpassthru($stream);
            } finally {
                fclose($stream);
            }
        }, 200, ['Content-Type' => $record->mime_type, 'Content-Disposition' => 'inline', 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
    }

    private function authorizeWrite(Request $request): void
    {
        abort_unless(in_array($request->attributes->get('membership')?->role, ['owner', 'admin'], true), 403, 'Somente administradores podem alterar a marca do negócio.');
    }
}
