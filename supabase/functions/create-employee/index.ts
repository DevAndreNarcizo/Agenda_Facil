import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type EmployeeRole = 'admin' | 'employee' | 'staff';

/**
 * Valida os dados de convite de um profissional antes do uso administrativo.
 *
 * @author André Narcizo
 */
function parseEmployee(payload: unknown): { email: string; password: string; fullName: string; role: EmployeeRole } | null {
  if (!payload || typeof payload !== 'object') return null;
  const { email, password, fullName, role = 'employee' } = payload as Record<string, unknown>;
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8 || typeof fullName !== 'string' || fullName.trim().length < 2) return null;
  if (role !== 'admin' && role !== 'employee' && role !== 'staff') return null;
  return { email: email.trim().toLowerCase(), password, fullName: fullName.trim(), role };
}

serve(async (request) => {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405 });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('authorization');
    const employee = parseEmployee(await request.json());
    if (!url || !anonKey || !serviceKey || !authorization || !employee) return new Response(JSON.stringify({ error: 'Dados inválidos.' }), { status: 400 });

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });

    const admin = createClient(url, serviceKey);
    const { data: callerProfile, error: callerError } = await admin.from('profiles').select('organization_id, role').eq('id', user.id).single();
    if (callerError || !callerProfile?.organization_id || !['owner', 'admin'].includes(callerProfile.role)) return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403 });

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: employee.email, password: employee.password, email_confirm: true, user_metadata: { full_name: employee.fullName } });
    if (createError || !created.user) throw createError ?? new Error('Usuário não criado.');

    const { error: profileError } = await admin.from('profiles').upsert({ id: created.user.id, organization_id: callerProfile.organization_id, full_name: employee.fullName, role: employee.role });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    return new Response(JSON.stringify({ id: created.user.id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Erro ao criar profissional:', error);
    return new Response(JSON.stringify({ error: 'Não foi possível criar o profissional.' }), { status: 500 });
  }
});
