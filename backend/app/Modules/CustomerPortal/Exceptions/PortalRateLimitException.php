<?php

declare(strict_types=1);

namespace Modules\CustomerPortal\Exceptions;

use RuntimeException;

/**
 * Lançada quando o rate-limit de OTP é excedido. Mapeada para HTTP 429.
 */
final class PortalRateLimitException extends RuntimeException {}
