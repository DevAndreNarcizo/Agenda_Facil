import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-portal-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

export type PortalSession = {
  customerId: string;
  organizationId: string;
  sessionId: string;
};

/**
 * Cria uma resposta JSON com os cabeçalhos CORS necessários ao portal público.
 *
 * @author André Narcizo
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

/**
 * Cria o cliente administrativo usado exclusivamente dentro das Edge Functions.
 *
 * @author André Narcizo
 */
export function createAdminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

/**
 * Normaliza um telefone brasileiro/E.164 recebido pelo portal.
 *
 * @author André Narcizo
 */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const phone = value.replace(/\D/g, '');
  return /^\d{10,15}$/.test(phone) ? phone : null;
}

/**
 * Gera um hash SHA-256 com segredo de ambiente para não persistir credenciais brutas.
 *
 * @author André Narcizo
 */
export async function hashSecret(value: string): Promise<string | null> {
  const pepper = Deno.env.get('PORTAL_TOKEN_PEPPER');
  if (!pepper) return null;
  const data = new TextEncoder().encode(`${pepper}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Gera um token criptograficamente aleatório para uma sessão de portal.
 *
 * @author André Narcizo
 */
export function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Gera um OTP de seis dígitos sem registrá-lo em logs ou respostas HTTP.
 *
 * @author André Narcizo
 */
export function createOtpCode(): string {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6).padStart(6, '0');
}

/**
 * Obtém um identificador de origem sem expor o IP bruto no banco.
 *
 * @author André Narcizo
 */
export function getRequestIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Extrai o token opaco transportado apenas no cabeçalho dedicado do portal.
 *
 * @author André Narcizo
 */
export function getPortalToken(request: Request): string | null {
  const token = request.headers.get('x-portal-session');
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

/**
 * Valida uma sessão opaca ativa e atualiza sua última utilização.
 *
 * @author André Narcizo
 */
export async function requirePortalSession(request: Request): Promise<PortalSession | null> {
  const admin = createAdminClient();
  const token = getPortalToken(request);
  if (!admin || !token) return null;

  const tokenHash = await hashSecret(token);
  if (!tokenHash) return null;

  const { data, error } = await admin
    .from('portal_sessions')
    .select('id, customer_id, organization_id')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  await admin.from('portal_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  return { customerId: data.customer_id, organizationId: data.organization_id, sessionId: data.id };
}
