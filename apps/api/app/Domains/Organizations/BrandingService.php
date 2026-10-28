<?php

declare(strict_types=1);

namespace App\Domains\Organizations;

use App\Domains\Audit\Audit;
use App\Domains\Files\PrivateFileService;
use App\Domains\Organizations\Models\Organization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final class BrandingService
{
    public function __construct(private readonly PrivateFileService $files) {}

    /** O arquivo permanece privado; apenas a seleção do logo autoriza a apresentação pública. @author André Narcizo */
    public function replace(Organization $organization, string $actorId, UploadedFile $file): Organization
    {
        $record = $this->files->upload($organization->id, $actorId, $file);
        try {
            return DB::transaction(function () use ($organization, $actorId, $record): Organization {
                $locked = Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();
                $locked->logo_file_id = $record->id;
                $locked->save();
                Audit::record($organization->id, $actorId, 'organization.logo_selected', $record->id);

                return $locked->refresh();
            }, 3);
        } catch (Throwable) {
            try {
                $this->files->delete($organization->id, $record->id);
            } catch (Throwable) {
                Log::error('branding.upload_compensation_failed', ['file_id' => $record->id]);
            }
            abort(503, 'Não foi possível atualizar o logo. Tente novamente.');
        }
    }

    /** Despublicar não elimina arquivos nem histórico sem uma decisão explícita do administrador. @author André Narcizo */
    public function clear(Organization $organization, string $actorId): Organization
    {
        return DB::transaction(function () use ($organization, $actorId): Organization {
            $locked = Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $previous = $locked->logo_file_id;
            $locked->logo_file_id = null;
            $locked->save();
            if ($previous) {
                Audit::record($organization->id, $actorId, 'organization.logo_unselected', $previous);
            }

            return $locked->refresh();
        }, 3);
    }
}
