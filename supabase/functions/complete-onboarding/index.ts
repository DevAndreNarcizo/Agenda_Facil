import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createAdminClient, jsonResponse } from '../_shared/portal.ts';

type ScheduleItem = { active: boolean; dayOfWeek: number; end: string; start: string };

type OnboardingPayload = {
  address: string; bio: string; businessName: string; cep: string; city: string; instagram: string;
  number: string; schedule: ScheduleItem[]; serviceCategory: string; serviceDuration: number;
  serviceName: string; servicePrice: number; specialty: string; state: string;
};

/**
 * Normaliza o nome comercial em um slug estável e legível.
 *
 * @author André Narcizo
 */
function slugify(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/**
 * Valida integralmente os dados do onboarding antes da transação de banco.
 *
 * @author André Narcizo
 */
function parsePayload(value: unknown): OnboardingPayload | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const text = (key: string, max = 500): string | null => typeof data[key] === 'string' && data[key].trim().length <= max ? data[key].trim() : null;
  const businessName = text('businessName', 120);
  const serviceName = text('serviceName', 120);
  const price = typeof data.servicePrice === 'number' ? data.servicePrice : Number(data.servicePrice);
  const duration = typeof data.serviceDuration === 'number' ? data.serviceDuration : Number(data.serviceDuration);
  if (!businessName || !serviceName || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 5 || duration > 480 || !Array.isArray(data.schedule) || data.schedule.length !== 7) return null;
  const schedule = data.schedule.map((item, dayOfWeek) => {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.active !== 'boolean' || typeof entry.start !== 'string' || typeof entry.end !== 'string' || !/^\d{2}:\d{2}$/.test(entry.start) || !/^\d{2}:\d{2}$/.test(entry.end) || entry.end <= entry.start) return null;
    return { active: entry.active, dayOfWeek, end: entry.end, start: entry.start };
  });
  if (schedule.some((item) => item === null)) return null;
  return { address: text('address') ?? '', bio: text('bio', 2_000) ?? '', businessName, cep: text('cep', 20) ?? '', city: text('city', 100) ?? '', instagram: text('instagram', 100) ?? '', number: text('number', 20) ?? '', schedule: schedule as ScheduleItem[], serviceCategory: text('serviceCategory', 80) ?? '', serviceDuration: duration, serviceName, servicePrice: price, specialty: text('specialty', 120) ?? '', state: text('state', 50) ?? '' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);
  try {
    const payload = parsePayload(await request.json());
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authorization = request.headers.get('authorization');
    const admin = createAdminClient();
    if (!payload || !url || !anonKey || !authorization || !admin) return jsonResponse({ error: 'Dados inválidos.' }, 400);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Não autorizado.' }, 401);

    const { data: organizationId, error } = await admin.rpc('complete_onboarding', { p_payload: { ...payload, slug: slugify(payload.businessName) }, p_user_id: user.id });
    if (error) return jsonResponse({ error: error.code === '23505' ? 'Nome de endereço indisponível.' : 'Não foi possível concluir o onboarding.' }, error.code === '23505' ? 409 : 400);
    return jsonResponse({ organizationId }, 200);
  } catch {
    return jsonResponse({ error: 'Não foi possível concluir o onboarding.' }, 500);
  }
});
