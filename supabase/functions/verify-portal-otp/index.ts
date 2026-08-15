import { corsHeaders, createAdminClient, createOpaqueToken, getRequestIp, hashSecret, jsonResponse, normalizePhone } from '../_shared/portal.ts';

/**
 * Responde ao preflight da confirmação de OTP.
 *
 * @author André Narcizo
 */
function preflightResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  try {
    const { code, phone } = await request.json();
    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = typeof code === 'string' && /^\d{6}$/.test(code) ? code : null;
    const admin = createAdminClient();
    if (!normalizedPhone || !normalizedCode || !admin) return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);

    const phoneHash = await hashSecret(normalizedPhone);
    const ipHash = await hashSecret(getRequestIp(request));
    const codeHash = await hashSecret(normalizedCode);
    if (!phoneHash || !ipHash || !codeHash) return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);

    const { data: challenge } = await admin
      .from('portal_otp_challenges')
      .select('id, attempts, code_hash, customer_id, expires_at, organization_id')
      .eq('phone_hash', phoneHash)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge || challenge.attempts >= 5 || new Date(challenge.expires_at).getTime() <= Date.now()) {
      if (challenge) await admin.from('portal_otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id);
      return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);
    }

    const validCode = challenge.code_hash === codeHash;
    await admin
      .from('portal_otp_challenges')
      .update({ attempts: challenge.attempts + 1, consumed_at: validCode ? new Date().toISOString() : null, ip_hash: ipHash })
      .eq('id', challenge.id)
      .is('consumed_at', null);

    if (!validCode) return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);

    const token = createOpaqueToken();
    const tokenHash = await hashSecret(token);
    if (!tokenHash) return jsonResponse({ error: 'Não foi possível concluir o acesso.' }, 503);

    await admin.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('customer_id', challenge.customer_id).is('revoked_at', null);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from('portal_sessions').insert({
      customer_id: challenge.customer_id,
      expires_at: expiresAt,
      organization_id: challenge.organization_id,
      token_hash: tokenHash,
    });
    if (error) throw error;

    return jsonResponse({ expiresAt, token }, 201);
  } catch {
    return jsonResponse({ error: 'Não foi possível concluir o acesso.' }, 500);
  }
});
