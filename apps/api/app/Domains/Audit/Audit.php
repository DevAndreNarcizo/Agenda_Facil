<?php

declare(strict_types=1);

namespace App\Domains\Audit;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class Audit
{
    /** Registra somente referências técnicas, sem payload pessoal ou segredos. @author André Narcizo */
    public static function record(?string $organizationId, ?string $actorId, string $action, ?string $resourceId = null): void
    {
        DB::table('audit_logs')->insert(['id' => (string) Str::uuid(), 'organization_id' => $organizationId, 'actor_id' => $actorId, 'action' => $action, 'resource_id' => $resourceId, 'metadata' => '{}', 'created_at' => now()]);
    }
}
