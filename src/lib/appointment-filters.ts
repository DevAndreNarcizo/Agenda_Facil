export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentView = 'day' | 'week' | 'month';

export interface AppointmentFilters {
  date: string;
  view: AppointmentView;
  employeeId?: string;
  statuses: AppointmentStatus[];
  page: number;
  pageSize: number;
}

export interface AppointmentUtcRange {
  start: Date;
  end: Date;
}

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_VIEW: AppointmentView = 'week';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normaliza os filtros recebidos pela URL para valores seguros e previsíveis.
 *
 * @author André Narcizo
 */
export function normalizeAppointmentFilters(
  searchParams: URLSearchParams,
): AppointmentFilters {
  const date = searchParams.get('date');
  const employeeId = searchParams.get('employee');

  return {
    date: isValidDateKey(date) ? date : getTodayInSaoPaulo(),
    view: normalizeView(searchParams.get('view')),
    ...(isUuid(employeeId) ? { employeeId: employeeId.toLowerCase() } : {}),
    statuses: normalizeStatuses(searchParams.get('status')),
    page: normalizeInteger(searchParams.get('page'), DEFAULT_PAGE, DEFAULT_PAGE),
    pageSize: normalizeInteger(
      searchParams.get('pageSize'),
      MIN_PAGE_SIZE,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
  };
}

/**
 * Deriva o intervalo UTC semiaberto [start, end) para a data e visualização informadas.
 * A semana começa no domingo, conforme a convenção do calendário da aplicação.
 *
 * @author André Narcizo
 */
export function getAppointmentUtcRange(
  date: string,
  view: AppointmentView,
): AppointmentUtcRange {
  if (!isValidDateKey(date)) {
    throw new RangeError('A data deve estar no formato YYYY-MM-DD e ser válida.');
  }

  const startDate = createUtcCalendarDate(date);
  const endDate = new Date(startDate);

  if (view === 'week') {
    startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());
    endDate.setTime(startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + 7);
  } else if (view === 'month') {
    startDate.setUTCDate(1);
    endDate.setTime(startDate.getTime());
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  } else {
    endDate.setUTCDate(endDate.getUTCDate() + 1);
  }

  return {
    start: saoPauloMidnightToUtc(startDate),
    end: saoPauloMidnightToUtc(endDate),
  };
}

/**
 * Verifica se uma string representa uma data civil válida no formato YYYY-MM-DD.
 *
 * @author André Narcizo
 */
function isValidDateKey(value: string | null): value is string {
  if (value === null) {
    return false;
  }

  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = createUtcDate(year, month - 1, day);

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

/**
 * Retorna a data corrente no fuso horário America/Sao_Paulo.
 *
 * @author André Narcizo
 */
function getTodayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Converte uma data civil em uma data usada apenas para cálculos de calendário UTC.
 *
 * @author André Narcizo
 */
function createUtcCalendarDate(date: string): Date {
  const match = DATE_PATTERN.exec(date);

  if (match === null) {
    throw new RangeError('A data deve estar no formato YYYY-MM-DD.');
  }

  return createUtcDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Cria uma data UTC sem aplicar a conversão especial de anos entre 0 e 99 do Date.UTC.
 *
 * @author André Narcizo
 */
function createUtcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);

  return date;
}

/**
 * Converte a meia-noite de uma data civil de São Paulo para o instante UTC correspondente.
 *
 * @author André Narcizo
 */
function saoPauloMidnightToUtc(localDate: Date): Date {
  const localMidnightTimestamp = localDate.getTime();
  const noonUtc = new Date(localMidnightTimestamp + 12 * 60 * 60 * 1000);

  return new Date(localMidnightTimestamp - getSaoPauloOffsetMilliseconds(noonUtc));
}

/**
 * Calcula o deslocamento de America/Sao_Paulo para um instante UTC.
 *
 * @author André Narcizo
 */
function getSaoPauloOffsetMilliseconds(utcDate: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcDate);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  const localTimestamp = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return localTimestamp - utcDate.getTime();
}

/**
 * Normaliza uma visualização de agenda para os valores aceitos pela aplicação.
 *
 * @author André Narcizo
 */
function normalizeView(value: string | null): AppointmentView {
  if (value === 'day' || value === 'week' || value === 'month') {
    return value;
  }

  return DEFAULT_VIEW;
}

/**
 * Verifica se o valor possui o formato UUID aceito para o identificador do funcionário.
 *
 * @author André Narcizo
 */
function isUuid(value: string | null): value is string {
  return value !== null && UUID_PATTERN.test(value);
}

/**
 * Mantém somente status permitidos e remove valores duplicados preservando a ordem da URL.
 *
 * @author André Narcizo
 */
function normalizeStatuses(value: string | null): AppointmentStatus[] {
  if (value === null || value === '') {
    return [];
  }

  return [...new Set(
    value
      .split(',')
      .map((status) => status.trim())
      .filter(isAppointmentStatus),
  )];
}

/**
 * Verifica se um status pertence ao conjunto suportado pela agenda.
 *
 * @author André Narcizo
 */
function isAppointmentStatus(value: string): value is AppointmentStatus {
  return APPOINTMENT_STATUSES.some((status) => status === value);
}

/**
 * Converte um inteiro positivo da URL e limita o resultado aos limites informados.
 *
 * @author André Narcizo
 */
function normalizeInteger(
  value: string | null,
  minimum: number,
  fallback: number,
  maximum?: number,
): number {
  if (value === null || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return fallback;
  }

  return maximum === undefined
    ? Math.max(minimum, parsed)
    : Math.min(Math.max(minimum, parsed), maximum);
}
