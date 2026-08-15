import { supabase } from '@/lib/supabase';

const PORTAL_SESSION_KEY = 'agenda_facil_portal_session';

type PortalFunctionError = Error & { status?: number };

export interface PortalCustomer {
  id: string;
  name: string;
}

export interface PortalService {
  duration_minutes: number;
  id: string;
  name: string;
  price: number;
}

export interface PortalAppointment {
  end_time: string;
  id: string;
  start_time: string;
  status: string;
  services: PortalService | null;
}

/**
 * Obtém o token opaco do portal sem persistir identificadores do cliente.
 *
 * @author André Narcizo
 */
export function getPortalSessionToken(): string | null {
  return localStorage.getItem(PORTAL_SESSION_KEY);
}

/**
 * Persiste exclusivamente o token opaco emitido pelo servidor.
 *
 * @author André Narcizo
 */
export function setPortalSessionToken(token: string): void {
  localStorage.setItem(PORTAL_SESSION_KEY, token);
}

/**
 * Remove a credencial local do portal após logout ou expiração.
 *
 * @author André Narcizo
 */
export function clearPortalSessionToken(): void {
  localStorage.removeItem(PORTAL_SESSION_KEY);
}

/**
 * Normaliza uma falha de Edge Function preservando apenas o status necessário ao fluxo.
 *
 * @author André Narcizo
 */
function createPortalError(error: unknown): PortalFunctionError {
  const result = new Error('Não foi possível concluir esta operação.') as PortalFunctionError;
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: { status?: unknown } }).context;
    if (typeof context?.status === 'number') result.status = context.status;
  }
  return result;
}

/**
 * Invoca uma Edge Function pública usando o token opaco apenas quando necessário.
 *
 * @author André Narcizo
 */
async function invokePortalFunction<T>(functionName: string, body: Record<string, unknown>, requiresSession = false): Promise<T> {
  const token = requiresSession ? getPortalSessionToken() : null;
  if (requiresSession && !token) {
    const error = new Error('Sessão inválida ou expirada.') as PortalFunctionError;
    error.status = 401;
    throw error;
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: token ? { 'x-portal-session': token } : undefined,
  });
  if (error) throw createPortalError(error);
  return data as T;
}

/**
 * Solicita um OTP sem revelar se o telefone possui cadastro.
 *
 * @author André Narcizo
 */
export async function requestPortalOtp(phone: string, organizationSlug?: string): Promise<void> {
  await invokePortalFunction('request-portal-otp', { organizationSlug, phone });
}

/**
 * Troca um OTP válido por uma sessão opaca de curta duração.
 *
 * @author André Narcizo
 */
export async function verifyPortalOtp(phone: string, code: string, organizationSlug?: string): Promise<void> {
  const response = await invokePortalFunction<{ token?: unknown }>('verify-portal-otp', { code, organizationSlug, phone });
  if (typeof response.token !== 'string' || !/^[a-f0-9]{64}$/i.test(response.token)) {
    throw new Error('Não foi possível concluir o acesso.');
  }
  setPortalSessionToken(response.token);
}

/**
 * Valida a sessão atual e obtém o nome para exibição temporária na interface.
 *
 * @author André Narcizo
 */
export async function getPortalSession(): Promise<PortalCustomer> {
  const response = await invokePortalFunction<{ customer?: PortalCustomer }>('portal-session', { action: 'me' }, true);
  if (!response.customer || typeof response.customer.id !== 'string' || typeof response.customer.name !== 'string') {
    throw new Error('Sessão inválida ou expirada.');
  }
  return response.customer;
}

/**
 * Revoga a sessão no servidor e limpa o token local independentemente da resposta.
 *
 * @author André Narcizo
 */
export async function logoutPortalSession(): Promise<void> {
  try {
    await invokePortalFunction('portal-session', { action: 'logout' }, true);
  } finally {
    clearPortalSessionToken();
  }
}

/**
 * Lista serviços pertencentes exclusivamente à organização da sessão atual.
 *
 * @author André Narcizo
 */
export async function getPortalServices(): Promise<PortalService[]> {
  const response = await invokePortalFunction<{ services?: PortalService[] }>('portal-booking', { action: 'services' }, true);
  return Array.isArray(response.services) ? response.services : [];
}

/**
 * Lista os agendamentos vinculados exclusivamente ao cliente autenticado no portal.
 *
 * @author André Narcizo
 */
export async function getPortalAppointments(): Promise<PortalAppointment[]> {
  const response = await invokePortalFunction<{ appointments?: PortalAppointment[] }>('portal-booking', { action: 'appointments' }, true);
  return Array.isArray(response.appointments) ? response.appointments : [];
}

/**
 * Cria uma reserva validada integralmente no servidor.
 *
 * @author André Narcizo
 */
export async function createPortalBooking(serviceId: string, date: string, time: string): Promise<void> {
  await invokePortalFunction('portal-booking', { action: 'create', date, serviceId, time }, true);
}
