<?php

declare(strict_types=1);

namespace Modules\Billing\Exceptions;

use RuntimeException;

/**
 * Lançada quando uma operação ultrapassaria o limite do plano. Mapeada para HTTP 402/403.
 */
final class QuotaExceededException extends RuntimeException
{
    public function __construct(
        public readonly string $entitlementKey,
        public readonly int $limit,
        public readonly int $current,
    ) {
        parent::__construct("Limite do plano atingido para '{$entitlementKey}' ({$current}/{$limit}).");
    }
}
