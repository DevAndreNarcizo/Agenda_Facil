<?php

declare(strict_types=1);

namespace Modules\PublicBooking\Exceptions;

use RuntimeException;

/**
 * Lançada quando a reserva pública está indisponível ou o recurso não é permitido.
 * Mapeada para HTTP 404 (não vaza existência de dados de outras organizações).
 */
final class PublicBookingUnavailableException extends RuntimeException {}
