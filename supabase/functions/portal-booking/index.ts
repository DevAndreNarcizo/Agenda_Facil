import { corsHeaders, createAdminClient, jsonResponse, requirePortalSession } from '../_shared/portal.ts';

type PortalAction = 'appointments' | 'create' | 'services';

/**
 * Responde ao preflight do gateway de agenda do portal.
 *
 * @author André Narcizo
 */
function preflightResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Converte data e horário do portal para um instante no fuso America/Sao_Paulo.
 *
 * @author André Narcizo
 */
function parseSaoPauloDateTime(date: unknown, time: unknown): Date | null {
  if (typeof date !== 'string' || typeof time !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const result = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

/**
 * Identifica o conflito protegido tanto em aplicação quanto por constraint do banco.
 *
 * @author André Narcizo
 */
function isScheduleConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23P01');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  const session = await requirePortalSession(request);
  if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action as PortalAction | undefined;
  const admin = createAdminClient();
  if (!body || !admin || !action) return jsonResponse({ error: 'Dados inválidos.' }, 400);

  if (action === 'services') {
    const { data, error } = await admin
      .from('services')
      .select('duration_minutes, id, name, price')
      .eq('organization_id', session.organizationId)
      .eq('is_active', true)
      .order('name');
    if (error) return jsonResponse({ error: 'Não foi possível listar os serviços.' }, 500);
    return jsonResponse({ services: data });
  }

  if (action === 'appointments') {
    const { data, error } = await admin
      .from('appointments')
      .select('end_time, id, start_time, status, services(name, price, duration_minutes)')
      .eq('customer_id', session.customerId)
      .eq('organization_id', session.organizationId)
      .order('start_time', { ascending: false });
    if (error) return jsonResponse({ error: 'Não foi possível listar os agendamentos.' }, 500);
    return jsonResponse({ appointments: data });
  }

  if (action !== 'create') return jsonResponse({ error: 'Ação inválida.' }, 400);

  const serviceId = typeof body.serviceId === 'string' ? body.serviceId : null;
  const startTime = parseSaoPauloDateTime(body.date, body.time);
  if (!serviceId || !startTime || startTime.getTime() <= Date.now()) return jsonResponse({ error: 'Data ou serviço inválido.' }, 400);
  if (startTime.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) return jsonResponse({ error: 'Data fora do período permitido.' }, 400);

  const { data: service, error: serviceError } = await admin
    .from('services')
    .select('duration_minutes, id')
    .eq('id', serviceId)
    .eq('organization_id', session.organizationId)
    .eq('is_active', true)
    .maybeSingle();
  if (serviceError || !service) return jsonResponse({ error: 'Serviço indisponível.' }, 404);

  const endTime = new Date(startTime.getTime() + service.duration_minutes * 60_000);
  const { data: conflict, error: conflictError } = await admin
    .from('appointments')
    .select('id')
    .eq('organization_id', session.organizationId)
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())
    .limit(1)
    .maybeSingle();
  if (conflictError) return jsonResponse({ error: 'Não foi possível validar o horário.' }, 500);
  if (conflict) return jsonResponse({ error: 'Este horário não está disponível.' }, 409);

  const { data: customer } = await admin
    .from('customers')
    .select('name, phone')
    .eq('id', session.customerId)
    .eq('organization_id', session.organizationId)
    .maybeSingle();
  if (!customer) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);

  const { data: appointment, error: appointmentError } = await admin
    .from('appointments')
    .insert({
      customer_id: session.customerId,
      customer_name: customer.name,
      customer_phone: customer.phone,
      end_time: endTime.toISOString(),
      organization_id: session.organizationId,
      service_id: service.id,
      start_time: startTime.toISOString(),
      status: 'pending',
    })
    .select('id, end_time, start_time, status')
    .single();

  if (isScheduleConflict(appointmentError)) return jsonResponse({ error: 'Este horário não está disponível.' }, 409);
  if (appointmentError || !appointment) return jsonResponse({ error: 'Não foi possível criar o agendamento.' }, 500);
  return jsonResponse({ appointment }, 201);
});
