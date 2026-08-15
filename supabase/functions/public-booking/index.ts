import { corsHeaders, createAdminClient, jsonResponse, requirePortalSession } from '../_shared/portal.ts';

type PublicBookingAction = 'availability' | 'context' | 'create';
type RpcError = { code?: string };

/**
 * Responde ao preflight do gateway público de reservas.
 *
 * @author André Narcizo
 */
function preflightResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Extrai uma string não vazia de um payload não confiável.
 *
 * @author André Narcizo
 */
function getRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Mapeia erros controlados das RPCs para respostas públicas estáveis.
 *
 * @author André Narcizo
 */
function rpcErrorResponse(error: RpcError, fallback: string): Response {
  switch (error.code) {
    case '22023':
      return jsonResponse({ error: 'Dados de reserva inválidos.' }, 400);
    case '23P01':
      return jsonResponse({ error: 'Este horário não está disponível.' }, 409);
    case '42501':
      return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
    case 'P0001':
      return jsonResponse({ error: 'Reserva pública indisponível.' }, 404);
    default:
      return jsonResponse({ error: fallback }, 500);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action as PublicBookingAction | undefined;
  const slug = getRequiredString(body?.slug);
  const admin = createAdminClient();
  if (!body || !slug || !admin || !action) return jsonResponse({ error: 'Dados inválidos.' }, 400);

  if (action === 'context') {
    const { data, error } = await admin.rpc('get_public_booking_context', { p_slug: slug });
    if (error || !data) return rpcErrorResponse(error ?? {}, 'Não foi possível carregar a reserva pública.');
    return jsonResponse({ context: data });
  }

  const serviceId = getRequiredString(body.serviceId);
  const employeeId = getRequiredString(body.employeeId);
  if (!serviceId) return jsonResponse({ error: 'Dados inválidos.' }, 400);

  if (action === 'availability') {
    const date = getRequiredString(body.date);
    if (!date) return jsonResponse({ error: 'Dados inválidos.' }, 400);
    const { data, error } = await admin.rpc('get_public_available_slots', {
      p_date: date,
      p_employee_id: employeeId,
      p_service_id: serviceId,
      p_slug: slug,
    });
    if (error || !data) return rpcErrorResponse(error ?? {}, 'Não foi possível consultar a disponibilidade.');
    return jsonResponse({ slots: data });
  }

  if (action !== 'create') return jsonResponse({ error: 'Ação inválida.' }, 400);

  const startTime = getRequiredString(body.startTime);
  const source = getRequiredString(body.source) ?? 'direct';
  if (!startTime) return jsonResponse({ error: 'Dados inválidos.' }, 400);

  const session = await requirePortalSession(request);
  if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);

  const { data, error } = await admin.rpc('create_public_booking', {
    p_employee_id: employeeId,
    p_service_id: serviceId,
    p_session_id: session.sessionId,
    p_slug: slug,
    p_source: source,
    p_start_time: startTime,
  });
  if (error || !data) return rpcErrorResponse(error ?? {}, 'Não foi possível concluir a reserva.');
  return jsonResponse({ booking: data }, 201);
});
