import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface Envelope<T> {
  data: T;
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  primary_color: string | null;
}
export interface Membership {
  role: 'owner' | 'admin' | 'employee';
}
export interface Subscription {
  status: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  plan_code?: string;
  plan_name?: string;
  price_cents?: number;
  billing_available?: boolean;
  cancel_at_period_end?: boolean;
  synthetic?: boolean;
  entitlements?: Record<string, number | null>;
}
export interface Identity {
  user: { id: string; name: string; email: string };
  organization: Organization | null;
  membership: Membership | null;
  subscription: Subscription | null;
}
export interface Resource {
  id: string;
  name: string;
  duration_minutes?: number;
  price_cents?: number;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
}
export interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  customer?: Resource;
  service?: Resource;
  professional?: Resource;
  customer_id?: string;
  service_id?: string;
  professional_id?: string;
}
export interface Plan {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  synthetic?: boolean;
  entitlements?: Record<string, number | boolean | null>;
}

/** Cliente REST same-origin; o servidor resolve o tenant pela sessão. @author André Narcizo */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  async get<T>(path: string): Promise<T> {
    return (await firstValueFrom(this.http.get<Envelope<T>>(`/api/v1${path}`))).data;
  }
  async post<T>(path: string, body: unknown = {}, headers?: Record<string, string>): Promise<T> {
    return (await firstValueFrom(this.http.post<Envelope<T>>(`/api/v1${path}`, body, { headers })))
      ?.data;
  }
  async patch<T>(path: string, body: unknown): Promise<T> {
    return (await firstValueFrom(this.http.patch<Envelope<T>>(`/api/v1${path}`, body)))?.data;
  }
  async delete(path: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/v1${path}`));
  }
  async csrf(): Promise<void> {
    await firstValueFrom(this.http.get('/sanctum/csrf-cookie'));
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return 'Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.';
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (error.status === 403)
      return typeof error.error?.message === 'string' && error.error.message.trim()
        ? error.error.message
        : 'Você não tem permissão para esta operação.';
    if (error.status === 409)
      return (
        error.error?.message ?? 'Este horário ou registro foi alterado. Atualize e tente novamente.'
      );
    if (error.status === 419)
      return 'A sessão de segurança expirou. Atualize a página e tente novamente.';
    if (error.status === 429)
      return 'Muitas tentativas. Aguarde um momento antes de tentar novamente.';
    if (error.status === 503)
      return (
        error.error?.message ?? 'Esta integração aguarda homologação e ainda está indisponível.'
      );
    if (error.status >= 500)
      return 'O servidor não conseguiu concluir esta operação. Tente novamente em instantes.';
    const messages = error.error?.errors as Record<string, string[]> | undefined;
    if (messages) return Object.values(messages).flat().join(' ');
    return error.error?.message ?? 'Não foi possível concluir esta operação. Tente novamente.';
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir esta operação.';
}

/** Formata instantes no fuso canônico do negócio. @author André Narcizo */
export function localDateTime(instant: string, timezone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(instant));
}
export function currency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

/** Converte entrada civil em instante, sem depender do fuso do navegador. @author André Narcizo */
export function zonedInstant(value: string, timeZone = 'America/Sao_Paulo'): string {
  const [day, clock] = value.split('T');
  if (!day || !clock) throw new Error('Informe a data e o horário.');
  const target = Date.parse(`${day}T${clock}:00Z`);
  let instant = target;
  for (let pass = 0; pass < 3; pass++) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const part = (name: string) => parts.find((item) => item.type === name)?.value ?? '';
    const actual = Date.parse(
      `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00Z`,
    );
    instant += target - actual;
  }
  return new Date(instant).toISOString();
}

/** Chave de calendário do tenant, independente do fuso do navegador. @author André Narcizo */
export function tenantDay(instant: string | Date, timezone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}
export function addCalendarDays(key: string, offset: number): string {
  const day = new Date(`${key}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
/** Intervalos semiabertos: semana inicia segunda e não duplica o último dia. @author André Narcizo */
export function calendarRange(
  key: string,
  view: string,
  timezone = 'America/Sao_Paulo',
): { start: string; end: string; days: string[] } {
  let first = key;
  let count = 1;
  if (view === 'week') {
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    first = addCalendarDays(key, -((weekday + 6) % 7));
    count = 7;
  }
  if (view === 'month') {
    first = key.slice(0, 7) + '-01';
    const next = new Date(`${first}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    count = Math.round((next.getTime() - Date.parse(`${first}T12:00:00Z`)) / 86400000);
  }
  const days = Array.from({ length: count }, (_, i) => addCalendarDays(first, i));
  return {
    start: zonedInstant(first + 'T00:00', timezone),
    end: zonedInstant(addCalendarDays(first, count) + 'T00:00', timezone),
    days,
  };
}
export function civilInput(instant: string, timezone = 'America/Sao_Paulo'): string {
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
  return date.replace(' ', 'T');
}
