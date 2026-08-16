import { createClient } from '@supabase/supabase-js';

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'AgendaFacil!Teste2026';
const REQUIRED_CONFIRMATION = 'I_UNDERSTAND_TEST_DATA';
const DEMO_ORGANIZATION_ID = '81000000-0000-4000-8000-000000000001';
const SERVICE_IDS = {
  corte: '81000000-0000-4000-8000-000000000011',
  barba: '81000000-0000-4000-8000-000000000012',
  combo: '81000000-0000-4000-8000-000000000013',
  hidratacao: '81000000-0000-4000-8000-000000000014',
};

const demoUsers = [
  { email: 'demo.owner@agenda-facil.test', fullName: 'Marina Demo', role: 'owner' },
  { email: 'demo.admin@agenda-facil.test', fullName: 'Rafael Demo', role: 'admin' },
  { email: 'demo.ana@agenda-facil.test', fullName: 'Ana Demo', role: 'employee' },
  { email: 'demo.bia@agenda-facil.test', fullName: 'Bia Demo', role: 'employee' },
];

/**
 * Interrompe o seeder com uma mensagem de diagnóstico segura.
 *
 * @author André Narcizo
 */
function fail(message) {
  throw new Error(message);
}

/**
 * Garante que a operação do Supabase foi concluída sem erro.
 *
 * @author André Narcizo
 */
function assertSuccess(result, context) {
  if (result.error) fail(`${context}: ${result.error.message}`);
  return result.data;
}

/**
 * Obtém todas as contas existentes que possuem e-mails de demonstração.
 *
 * @author André Narcizo
 */
async function findDemoUsers(admin) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  if (error) fail(`Não foi possível listar usuários de demonstração: ${error.message}`);

  const wantedEmails = new Set(demoUsers.map(({ email }) => email));
  return data.users.filter((user) => user.email && wantedEmails.has(user.email));
}

/**
 * Recria contas de demonstração pela API administrativa do Auth.
 *
 * @author André Narcizo
 */
async function recreateDemoUsers(admin) {
  const existingUsers = await findDemoUsers(admin);
  const existingIds = existingUsers.map((user) => user.id);
  if (existingIds.length > 0) {
    assertSuccess(await admin
      .from('organizations')
      .update({ owner_id: null })
      .eq('id', DEMO_ORGANIZATION_ID), 'Não foi possível liberar a organização de demonstração');
    assertSuccess(await admin
      .from('appointments')
      .update({ employee_id: null })
      .eq('organization_id', DEMO_ORGANIZATION_ID)
      .in('employee_id', existingIds), 'Não foi possível liberar agendamentos de demonstração');
    assertSuccess(await admin
      .from('appointment_blocks')
      .update({ employee_id: null })
      .eq('organization_id', DEMO_ORGANIZATION_ID)
      .in('employee_id', existingIds), 'Não foi possível liberar bloqueios de demonstração');
    assertSuccess(await admin
      .from('public_booking_settings')
      .update({ allowed_employee_ids: [] })
      .eq('organization_id', DEMO_ORGANIZATION_ID), 'Não foi possível liberar a reserva pública de demonstração');
  }
  for (const user of existingUsers) {
    assertSuccess(await admin.auth.admin.deleteUser(user.id), `Não foi possível remover ${user.email}`);
  }

  const createdUsers = new Map();
  for (const demoUser of demoUsers) {
    const { data, error } = await admin.auth.admin.createUser({
      email: demoUser.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: demoUser.fullName },
    });
    if (error || !data.user) fail(`Não foi possível criar ${demoUser.email}: ${error?.message ?? 'usuário ausente'}`);
    createdUsers.set(demoUser.email, { ...demoUser, id: data.user.id });
  }
  return createdUsers;
}

/**
 * Executa upsert e converte erros em falhas claras para o comando de seed.
 *
 * @author André Narcizo
 */
async function upsert(admin, table, payload, onConflict) {
  const query = admin.from(table).upsert(payload, { onConflict });
  assertSuccess(await query, `Não foi possível popular ${table}`);
}

/**
 * Cria ou atualiza os dados de negócio usados na demonstração.
 *
 * @author André Narcizo
 */
async function seedBusinessData(admin, users) {
  const owner = users.get('demo.owner@agenda-facil.test');
  const ana = users.get('demo.ana@agenda-facil.test');
  const bia = users.get('demo.bia@agenda-facil.test');
  if (!owner || !ana || !bia) fail('Contas de demonstração incompletas.');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const dateAt = (offsetDays, time) => {
    const date = new Date(`${today}T12:00:00-03:00`);
    date.setDate(date.getDate() + offsetDays);
    return `${date.toISOString().slice(0, 10)}T${time}:00-03:00`;
  };

  await upsert(admin, 'organizations', {
    id: DEMO_ORGANIZATION_ID,
    name: 'Studio Aurora Demo',
    slug: 'studio-aurora-demo',
    owner_id: owner.id,
    primary_color: '#5343d4',
    secondary_color: '#00616f',
    accent_color: '#ae5b70',
    onboarding_completed_at: new Date().toISOString(),
    plan_name: 'pro',
    subscription_status: 'active',
    updated_at: new Date().toISOString(),
  }, 'id');

  await upsert(admin, 'profiles', [...users.values()].map((user, index) => ({
    id: user.id,
    organization_id: DEMO_ORGANIZATION_ID,
    full_name: user.fullName,
    email: user.email,
    phone: `0000000000${index + 1}`,
    role: user.role,
    updated_at: new Date().toISOString(),
  })), 'id');

  await upsert(admin, 'organization_settings', {
    organization_id: DEMO_ORGANIZATION_ID,
    specialty: 'Beleza e bem-estar',
    instagram: '@studioaurorademo',
    bio: 'Ambiente fictício para validar todos os fluxos do Agenda Fácil.',
    address: { city: 'Goiânia', state: 'GO' },
    timezone: 'America/Sao_Paulo',
    updated_at: new Date().toISOString(),
  }, 'organization_id');

  await upsert(admin, 'organization_business_hours', Array.from({ length: 7 }, (_, dayOfWeek) => ({
    organization_id: DEMO_ORGANIZATION_ID,
    day_of_week: dayOfWeek,
    is_active: dayOfWeek < 6,
    start_time: '08:00',
    end_time: dayOfWeek === 5 ? '18:00' : '20:00',
  })), 'organization_id,day_of_week');

  await upsert(admin, 'services', [
    { id: SERVICE_IDS.corte, name: 'Corte feminino', category: 'Cabelo', duration_minutes: 60, price: 95 },
    { id: SERVICE_IDS.barba, name: 'Barba premium', category: 'Barbearia', duration_minutes: 45, price: 65 },
    { id: SERVICE_IDS.combo, name: 'Corte + barba', category: 'Barbearia', duration_minutes: 90, price: 145 },
    { id: SERVICE_IDS.hidratacao, name: 'Hidratação profunda', category: 'Tratamento', duration_minutes: 75, price: 120 },
  ].map((service) => ({ ...service, organization_id: DEMO_ORGANIZATION_ID, is_active: true })), 'id');

  const customers = [
    ['81000000-0000-4000-8000-000000000021', 'Camila Exemplo', '00000000021'],
    ['81000000-0000-4000-8000-000000000022', 'Diego Exemplo', '00000000022'],
    ['81000000-0000-4000-8000-000000000023', 'Elisa Exemplo', '00000000023'],
    ['81000000-0000-4000-8000-000000000024', 'Felipe Exemplo', '00000000024'],
    ['81000000-0000-4000-8000-000000000025', 'Giovana Exemplo', '00000000025'],
    ['81000000-0000-4000-8000-000000000026', 'Henrique Exemplo', '00000000026'],
  ];
  await upsert(admin, 'customers', customers.map(([id, name, phone]) => ({
    id, name, phone, organization_id: DEMO_ORGANIZATION_ID, email: `${name.split(' ')[0].toLowerCase()}@exemplo.test`,
  })), 'id');

  const appointments = [
    ['81000000-0000-4000-8000-000000000031', customers[0], SERVICE_IDS.corte, ana.id, -8, '11:00', '12:00', 'completed', 'paid', 95, 'instagram'],
    ['81000000-0000-4000-8000-000000000032', customers[1], SERVICE_IDS.barba, bia.id, -6, '15:00', '15:45', 'completed', 'paid', 65, 'google'],
    ['81000000-0000-4000-8000-000000000033', customers[2], SERVICE_IDS.combo, ana.id, -3, '09:00', '10:30', 'completed', 'paid', 145, 'qr'],
    ['81000000-0000-4000-8000-000000000034', customers[3], SERVICE_IDS.hidratacao, bia.id, 1, '10:00', '11:15', 'confirmed', 'pending', 0, 'site'],
    ['81000000-0000-4000-8000-000000000035', customers[4], SERVICE_IDS.corte, ana.id, 1, '14:00', '15:00', 'pending', 'pending', 0, 'referral'],
    ['81000000-0000-4000-8000-000000000036', customers[5], SERVICE_IDS.combo, bia.id, 2, '16:00', '17:30', 'cancelled', 'pending', 0, 'direct'],
  ];
  await upsert(admin, 'appointments', appointments.map(([id, customer, serviceId, employeeId, offset, start, end, status, paymentStatus, amountPaid, bookingSource]) => ({
    id,
    organization_id: DEMO_ORGANIZATION_ID,
    customer_id: customer[0],
    customer_name: customer[1],
    customer_phone: customer[2],
    service_id: serviceId,
    employee_id: employeeId,
    start_time: dateAt(offset, start),
    end_time: dateAt(offset, end),
    status,
    payment_status: paymentStatus,
    amount_paid: amountPaid,
    booking_source: bookingSource,
  })), 'id');

  await upsert(admin, 'appointment_blocks', {
    id: '81000000-0000-4000-8000-000000000041',
    organization_id: DEMO_ORGANIZATION_ID,
    employee_id: ana.id,
    start_time: dateAt(1, '16:00'),
    end_time: dateAt(1, '17:00'),
    reason: 'Pausa de demonstração',
  }, 'id');

  await upsert(admin, 'public_booking_settings', {
    organization_id: DEMO_ORGANIZATION_ID,
    is_enabled: true,
    allowed_service_ids: Object.values(SERVICE_IDS),
    allowed_employee_ids: [ana.id, bia.id],
    updated_at: new Date().toISOString(),
  }, 'organization_id');
}

/**
 * Valida que a conta owner gerada pelo seed é autenticável.
 *
 * @author André Narcizo
 */
async function verifyOwnerLogin(url, publishableKey) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: 'demo.owner@agenda-facil.test',
    password: DEMO_PASSWORD,
  });
  if (error) fail(`Seed criado, mas a autenticação da owner falhou: ${error.message}`);
  await client.auth.signOut();
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.SEED_DEMO_CONFIRM !== REQUIRED_CONFIRMATION) {
  fail(`Defina SEED_DEMO_CONFIRM=${REQUIRED_CONFIRMATION} para confirmar dados fictícios.`);
}
if (!url || !publishableKey || !serviceRoleKey) {
  fail('Defina SUPABASE_URL (ou VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY e uma chave pública.');
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const users = await recreateDemoUsers(admin);
await seedBusinessData(admin, users);
await verifyOwnerLogin(url, publishableKey);
console.log('Seed de demonstração concluído. Organização: Studio Aurora Demo.');
