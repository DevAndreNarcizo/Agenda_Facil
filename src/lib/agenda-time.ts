import { getAppointmentUtcRange } from "@/lib/appointment-filters";

export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

export interface ZonedParts {
  /** Data civil no formato YYYY-MM-DD. */
  dateKey: string;
  /** Minutos decorridos desde a meia-noite local. */
  minutes: number;
  /** Dia da semana local (0 = domingo). */
  weekday: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENDA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Decompõe um instante nas partes civis do fuso operacional (America/Sao_Paulo).
 * Base para posicionar eventos na grade da agenda independente do fuso do navegador.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getZonedParts(date: Date): ZonedParts {
  const values = Object.fromEntries(
    partsFormatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
    weekday: WEEKDAY_INDEX[values.weekday] ?? 0,
  };
}

/**
 * Converte data civil + minutos locais de São Paulo no instante UTC correspondente.
 * Reaproveita o cálculo de meia-noite já validado em appointment-filters.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function zonedDateTimeToUtc(dateKey: string, minutes: number): Date {
  const midnight = getAppointmentUtcRange(dateKey, "day").start;
  return new Date(midnight.getTime() + minutes * 60_000);
}

/**
 * Soma dias a uma data civil sem passar pelo fuso do navegador.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function addDaysToKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

/**
 * Retorna o dia da semana (0 = domingo) de uma data civil.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function weekdayOfKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

/**
 * Segunda-feira da semana que contém a data informada (convenção pt-BR do painel).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function mondayOfWeek(dateKey: string): string {
  const weekday = weekdayOfKey(dateKey);
  return addDaysToKey(dateKey, weekday === 0 ? -6 : 1 - weekday);
}

/**
 * Data civil de hoje no fuso operacional.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function todayKey(): string {
  return getZonedParts(new Date()).dateKey;
}

/**
 * Formata minutos locais como HH:MM.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * Converte "HH:MM[:SS]" (coluna time do Postgres) em minutos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Formata uma data civil com Intl em pt-BR, ancorada ao meio-dia UTC para não sofrer deslocamento.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" })
    .format(new Date(`${dateKey}T12:00:00.000Z`))
    .replace(/\./g, "");
}

/**
 * Formata um instante no fuso operacional em pt-BR (sem pontos de abreviação).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatInstant(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: AGENDA_TIME_ZONE })
    .format(typeof date === "string" ? new Date(date) : date)
    .replace(/\./g, "");
}
