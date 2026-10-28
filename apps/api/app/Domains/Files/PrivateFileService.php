<?php

declare(strict_types=1);

namespace App\Domains\Files;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class PrivateFileService
{
    /** Compensa escrita no objeto se a transação de metadados falhar. @author André Narcizo */
    public function upload(string $organizationId, string $userId, UploadedFile $file): object
    {
        $disk = (string) config('filesystems.private_disk', 'local');
        $storage = $this->storage($disk);
        $id = (string) Str::uuid();
        $mime = $file->getMimeType();
        $extension = match ($mime) {
            'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp',
            default => null,
        };
        abort_unless($extension && $file->getSize() > 0 && $file->getSize() <= 2 * 1024 * 1024, 422, 'Imagem inválida.');
        $path = $organizationId.'/'.$id.'.'.$extension;
        try {
            $content = $file->get();
            abort_unless($storage->put($path, $content, ['visibility' => 'private']), 503, 'Armazenamento privado indisponível.');

            return DB::transaction(function () use ($id, $organizationId, $userId, $disk, $path, $mime, $content): object {
                DB::table('private_files')->insert(['id' => $id, 'organization_id' => $organizationId, 'uploaded_by' => $userId, 'disk' => $disk, 'path' => $path, 'mime_type' => $mime, 'size_bytes' => strlen($content), 'sha256' => hash('sha256', $content), 'created_at' => now(), 'updated_at' => now()]);

                return DB::table('private_files')->where('id', $id)->first();
            });
        } catch (Throwable $exception) {
            try {
                if (! $storage->delete($path)) {
                    Log::error('private_file.upload_compensation_failed', ['file_id' => $id]);
                }
            } catch (Throwable) {
                Log::error('private_file.upload_compensation_failed', ['file_id' => $id]);
            }
            if ($exception instanceof HttpExceptionInterface) {
                throw $exception;
            }
            abort(503, 'Não foi possível armazenar a imagem privada.');
        }
    }

    /** Nunca busca arquivo por path recebido no browser. @author André Narcizo */
    public function find(string $organizationId, string $id): object
    {
        $record = DB::table('private_files')->where('organization_id', $organizationId)->where('id', $id)->first();
        abort_unless($record, 404, 'Arquivo não encontrado.');
        $extension = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'][$record->mime_type] ?? null;
        abort_unless($extension && $record->path === $organizationId.'/'.$id.'.'.$extension, 503, 'Metadados do arquivo exigem revisão.');

        return $record;
    }

    /** @return resource */
    public function stream(object $record)
    {
        try {
            $stream = $this->storage($record->disk)->readStream($record->path);
            abort_unless(is_resource($stream), 503, 'Arquivo temporariamente indisponível.');

            return $stream;
        } catch (Throwable $exception) {
            if ($exception instanceof HttpExceptionInterface) {
                throw $exception;
            }
            abort(503, 'Arquivo temporariamente indisponível.');
        }
    }

    /** Preserva metadados se falhar no objeto; restaura objeto se falhar no banco. @author André Narcizo */
    public function delete(string $organizationId, string $id): void
    {
        $record = $this->find($organizationId, $id);
        $storage = $this->storage($record->disk);
        $backup = null;
        $deleted = false;
        try {
            DB::transaction(function () use ($organizationId, $id, $record, $storage, &$backup, &$deleted): void {
                abort_unless(DB::table('private_files')->where('organization_id', $organizationId)->where('id', $id)->lockForUpdate()->first(), 404, 'Arquivo não encontrado.');
                $backup = $storage->get($record->path);
                abort_unless(is_string($backup), 503, 'Arquivo temporariamente indisponível.');
                abort_unless($storage->delete($record->path), 503, 'Não foi possível excluir a imagem privada.');
                $deleted = true;
                DB::table('private_files')->where('organization_id', $organizationId)->where('id', $id)->delete();
            });
        } catch (Throwable $exception) {
            if ($deleted && is_string($backup)) {
                try {
                    if (! $storage->put($record->path, $backup, ['visibility' => 'private'])) {
                        Log::error('private_file.delete_compensation_failed', ['file_id' => $id]);
                    }
                } catch (Throwable) {
                    Log::error('private_file.delete_compensation_failed', ['file_id' => $id]);
                }
            }
            if ($exception instanceof HttpExceptionInterface) {
                throw $exception;
            }
            abort(503, 'Não foi possível concluir a exclusão da imagem privada.');
        }
    }

    private function storage(string $disk): FilesystemAdapter
    {
        $driver = config('filesystems.disks.'.$disk.'.driver');
        abort_unless($driver === 's3' || ($disk === 'local' && $driver === 'local'), 503, 'Disco privado não configurado.');
        abort_if(app()->environment('production') && $driver !== 's3', 503, 'Produção exige storage privado compatível com S3.');
        abort_if(config('filesystems.disks.'.$disk.'.visibility') === 'public', 503, 'Disco público não autorizado.');

        return Storage::disk($disk);
    }
}
