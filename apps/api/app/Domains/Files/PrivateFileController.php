<?php

declare(strict_types=1);

namespace App\Domains\Files;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class PrivateFileController
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => DB::table('private_files')->where('organization_id', $this->tenant($request))->orderByDesc('created_at')->limit(100)->get(['id', 'mime_type', 'size_bytes', 'created_at'])]);
    }

    public function upload(Request $request, PrivateFileService $service): JsonResponse
    {
        $this->authorizeWrite($request);
        $request->validate(['file' => ['required', 'file', 'image', 'mimetypes:image/png,image/jpeg,image/webp', 'max:2048'], 'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'], 'disk' => ['prohibited'], 'path' => ['prohibited'], 'uploaded_by' => ['prohibited']]);
        $record = $service->upload($this->tenant($request), $request->user()->id, $request->file('file'));

        return response()->json(['data' => ['id' => $record->id, 'mime_type' => $record->mime_type, 'size_bytes' => $record->size_bytes, 'download_url' => '/api/v1/files/'.$record->id]], 201);
    }

    public function download(Request $request, string $id, PrivateFileService $service): StreamedResponse
    {
        $record = $service->find($this->tenant($request), $id);
        $stream = $service->stream($record);

        return response()->streamDownload(function () use ($stream): void {
            try {
                fpassthru($stream);
            } finally {
                fclose($stream);
            }
        }, basename($record->path), ['Content-Type' => $record->mime_type, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
    }

    public function delete(Request $request, string $id, PrivateFileService $service): JsonResponse
    {
        $this->authorizeWrite($request);
        abort_if(DB::table('organizations')->where('id', $this->tenant($request))->where('logo_file_id', $id)->exists(), 409, 'A imagem está em uso como logo. Troque ou remova o logo antes de excluir o arquivo.');
        $service->delete($this->tenant($request), $id);

        return response()->json(['data' => null]);
    }

    private function tenant(Request $request): string
    {
        $tenant = $request->attributes->get('organization');
        abort_unless($tenant, 403);

        return $tenant->id;
    }

    private function authorizeWrite(Request $request): void
    {
        abort_unless(in_array($request->attributes->get('membership')?->role, ['owner', 'admin'], true), 403, 'Somente administradores podem gerenciar arquivos privados.');
    }
}
