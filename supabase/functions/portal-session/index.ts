import { corsHeaders, createAdminClient, getPortalToken, hashSecret, jsonResponse, requirePortalSession } from '../_shared/portal.ts';

/**
 * Responde ao preflight da sessão opaca do portal.
 *
 * @author André Narcizo
 */
function preflightResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  const session = await requirePortalSession(request);
  if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);

  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (!body || (body.action !== 'me' && body.action !== 'logout')) return jsonResponse({ error: 'Ação inválida.' }, 400);

  const admin = createAdminClient();
  if (!admin) return jsonResponse({ error: 'Serviço indisponível.' }, 503);

  if (body.action === 'logout') {
    const token = getPortalToken(request);
    const tokenHash = token ? await hashSecret(token) : null;
    if (tokenHash) await admin.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const { data: customer, error } = await admin
    .from('customers')
    .select('id, name')
    .eq('id', session.customerId)
    .eq('organization_id', session.organizationId)
    .maybeSingle();
  if (error || !customer) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);

  return jsonResponse({ customer: { id: customer.id, name: customer.name } });
});
