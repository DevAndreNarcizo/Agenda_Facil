import { getPortalSessionToken } from '@/lib/portal-api';
import { supabase } from '@/lib/supabase';
import type { BookingSource } from '@/lib/public-booking-source';

export interface PublicBookingService {
  durationMinutes: number;
  id: string;
  name: string;
  price: number;
}

export interface PublicBookingEmployee {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface PublicBookingContext {
  employees: PublicBookingEmployee[];
  organization: {
    accentColor: string | null;
    logoUrl: string | null;
    name: string;
    primaryColor: string | null;
    secondaryColor: string | null;
    slug: string;
  };
  services: PublicBookingService[];
}

type PublicBookingError = Error & { status?: number };

/**
 * Normaliza falhas de Edge Function sem expor detalhes internos à interface.
 *
 * @author André Narcizo
 */
function createPublicBookingError(error: unknown): PublicBookingError {
  const result = new Error('Não foi possível concluir esta operação.') as PublicBookingError;
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: { status?: unknown } }).context;
    if (typeof context?.status === 'number') result.status = context.status;
  }
  return result;
}

/**
 * Invoca o gateway público sem enviar identidade da organização pelo cliente.
 *
 * @author André Narcizo
 */
async function invokePublicBooking<T>(body: Record<string, unknown>, requiresSession = false): Promise<T> {
  const token = requiresSession ? getPortalSessionToken() : null;
  if (requiresSession && !token) {
    const error = new Error('Sessão inválida ou expirada.') as PublicBookingError;
    error.status = 401;
    throw error;
  }

  const { data, error } = await supabase.functions.invoke('public-booking', {
    body,
    headers: token ? { 'x-portal-session': token } : undefined,
  });
  if (error) throw createPublicBookingError(error);
  return data as T;
}

/**
 * Carrega o catálogo público por slug canônico.
 *
 * @author André Narcizo
 */
export async function getPublicBookingContext(slug: string): Promise<PublicBookingContext> {
  const response = await invokePublicBooking<{ context?: PublicBookingContext }>({ action: 'context', slug });
  if (!response.context || !Array.isArray(response.context.services) || !Array.isArray(response.context.employees)) {
    throw new Error('Reserva pública indisponível.');
  }
  return response.context;
}

/**
 * Consulta slots calculados no servidor para a combinação selecionada.
 *
 * @author André Narcizo
 */
export async function getPublicAvailableSlots(input: {
  date: string;
  employeeId: string | null;
  serviceId: string;
  slug: string;
}): Promise<string[]> {
  const response = await invokePublicBooking<{ slots?: unknown }>({
    action: 'availability',
    date: input.date,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    slug: input.slug,
  });
  return Array.isArray(response.slots) && response.slots.every((slot) => typeof slot === 'string')
    ? response.slots
    : [];
}

/**
 * Conclui a reserva pública em nome da sessão opaca validada pelo servidor.
 *
 * @author André Narcizo
 */
export async function createPublicBooking(input: {
  employeeId: string | null;
  serviceId: string;
  slug: string;
  source: BookingSource;
  startTime: string;
}): Promise<void> {
  await invokePublicBooking({
    action: 'create',
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    slug: input.slug,
    source: input.source,
    startTime: input.startTime,
  }, true);
}
