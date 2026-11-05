<?php

declare(strict_types=1);

namespace Modules\Scheduling\Exceptions;

use RuntimeException;

/**
 * Lançada em conflito de horário ou intervalo inválido. Mapeada para HTTP 409.
 */
final class SchedulingConflictException extends RuntimeException {}
