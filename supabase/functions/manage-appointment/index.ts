import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";
type ProfileRole = "owner" | "admin" | "employee";

type CallerProfile = {
  id: string;
  organizationId: string;
  role: ProfileRole;
};

type CreateAppointmentPayload = {
  action: "create";
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  employeeId: string | null;
  endTime: string;
  isBlocked: boolean;
  notes: string | null;
  serviceId: string | null;
  startTime: string;
};

type UpdateStatusPayload = {
  action: "update-status";
  appointmentId: string;
  status: AppointmentStatus;
};

type CancelAppointmentPayload = {
  action: "cancel";
  appointmentId: string;
};

type AppointmentPayload =
  | CreateAppointmentPayload
  | UpdateStatusPayload
  | CancelAppointmentPayload;

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const APPOINTMENT_FIELDS =
  "id, customer_id, customer_name, customer_phone, employee_id, end_time, is_blocked, notes, organization_id, service_id, start_time, status";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ALLOWED_ROLES = new Set<ProfileRole>(["owner", "admin", "employee"]);
const ALLOWED_TRANSITIONS: Readonly<
  Record<
    Exclude<AppointmentStatus, "completed" | "cancelled">,
    readonly AppointmentStatus[]
  >
> = {
  confirmed: ["completed", "cancelled"],
  pending: ["confirmed", "cancelled"],
};

/**
 * Retorna respostas JSON consistentes com CORS para chamadas autenticadas do painel.
 *
 * @author André Narcizo
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

/**
 * Confere se uma string possui o formato UUID aceito pelas chaves do banco.
 *
 * @author André Narcizo
 */
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Normaliza texto opcional e rejeita conteúdos vazios ou acima do limite permitido.
 *
 * @author André Narcizo
 */
function parseOptionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength
    ? normalized
    : undefined;
}

/**
 * Valida um instante ISO com offset explícito para impedir ambiguidade de timezone.
 *
 * @author André Narcizo
 */
function parseDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATE_TIME_PATTERN.test(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Valida o payload de criação, mantendo o status inicial sempre como pending.
 *
 * @author André Narcizo
 */
function parseCreatePayload(
  data: Record<string, unknown>,
): CreateAppointmentPayload | null {
  const customerId = data.customerId ?? null;
  const employeeId = data.employeeId ?? null;
  const serviceId = data.serviceId ?? null;
  const customerName = parseOptionalText(data.customerName, 160);
  const customerPhone = parseOptionalText(data.customerPhone, 30);
  const notes = parseOptionalText(data.notes, 2_000);
  const startTime = parseDateTime(data.startTime);
  const endTime = parseDateTime(data.endTime);

  if (
    (customerId !== null && !isUuid(customerId)) ||
    (employeeId !== null && !isUuid(employeeId)) ||
    (serviceId !== null && !isUuid(serviceId)) || customerName === undefined ||
    customerPhone === undefined || notes === undefined || !startTime ||
    !endTime || new Date(endTime).getTime() <= new Date(startTime).getTime() ||
    (data.isBlocked !== undefined && typeof data.isBlocked !== "boolean")
  ) {
    return null;
  }

  if (customerId === null && !customerName) return null;

  return {
    action: "create",
    customerId: customerId as string | null,
    customerName,
    customerPhone,
    employeeId: employeeId as string | null,
    endTime,
    isBlocked: data.isBlocked === true,
    notes,
    serviceId: serviceId as string | null,
    startTime,
  };
}

/**
 * Valida a ação solicitada e limita os campos aceitos para cada operação.
 *
 * @author André Narcizo
 */
function parsePayload(value: unknown): AppointmentPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;

  if (data.action === "create") return parseCreatePayload(data);
  if (
    (data.action === "update-status" || data.action === "cancel") &&
    isUuid(data.appointmentId)
  ) {
    if (data.action === "cancel") {
      return { action: "cancel", appointmentId: data.appointmentId };
    }
    if (
      data.status === "pending" || data.status === "confirmed" ||
      data.status === "completed" || data.status === "cancelled"
    ) {
      return {
        action: "update-status",
        appointmentId: data.appointmentId,
        status: data.status,
      };
    }
  }

  return null;
}

/**
 * Cria o cliente autenticado que valida o JWT recebido antes de qualquer acesso privilegiado.
 *
 * @author André Narcizo
 */
function createUserClient(
  url: string,
  anonKey: string,
  authorization: string,
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
}

/**
 * Identifica o perfil atual no servidor e impede papéis fora do contrato da função.
 *
 * @author André Narcizo
 */
async function getCallerProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<CallerProfile | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (
    error || !data || !data.organization_id ||
    !ALLOWED_ROLES.has(data.role as ProfileRole)
  ) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    role: data.role as ProfileRole,
  };
}

/**
 * Detecta a violação de constraint de exclusão usada para bloquear sobreposição de agenda.
 *
 * @author André Narcizo
 */
function isScheduleConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error &&
      (error as { code?: string }).code === "23P01",
  );
}

/**
 * Busca um agendamento apenas dentro da organização do chamador.
 *
 * @author André Narcizo
 */
function getAppointment(
  admin: SupabaseClient,
  appointmentId: string,
  organizationId: string,
) {
  return admin
    .from("appointments")
    .select(APPOINTMENT_FIELDS)
    .eq("id", appointmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
}

/**
 * Garante que funcionários só gerenciem os próprios horários atribuídos.
 *
 * @author André Narcizo
 */
function canManageAppointment(
  caller: CallerProfile,
  employeeId: string | null,
): boolean {
  return caller.role !== "employee" || employeeId === caller.id;
}

/**
 * Verifica se o profissional informado pertence à mesma organização do chamador.
 *
 * @author André Narcizo
 */
async function validateEmployee(
  admin: SupabaseClient,
  employeeId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return !error && Boolean(data);
}

/**
 * Cria um agendamento validando vínculos de organização e disponibilidade no banco.
 *
 * @author André Narcizo
 */
async function createAppointment(
  admin: SupabaseClient,
  caller: CallerProfile,
  payload: CreateAppointmentPayload,
): Promise<Response> {
  if (!canManageAppointment(caller, payload.employeeId)) {
    return jsonResponse({
      error: "Funcionários só podem criar horários próprios.",
    }, 403);
  }

  const { count: profileCount, error: profileCountError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", caller.organizationId)
    .eq("role", "employee");
  if (profileCountError) {
    return jsonResponse({ error: "Não foi possível validar a equipe." }, 500);
  }
  if ((profileCount ?? 0) > 0 && !payload.employeeId) {
    return jsonResponse({
      error: "Profissional é obrigatório para organizações com equipe.",
    }, 400);
  }

  if (
    payload.employeeId &&
    !await validateEmployee(admin, payload.employeeId, caller.organizationId)
  ) {
    return jsonResponse(
      { error: "Profissional não pertence à organização." },
      400,
    );
  }

  let customerName = payload.customerName;
  let customerPhone = payload.customerPhone;
  if (payload.customerId) {
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id, name, phone")
      .eq("id", payload.customerId)
      .eq("organization_id", caller.organizationId)
      .maybeSingle();
    if (customerError) {
      return jsonResponse(
        { error: "Não foi possível validar o cliente." },
        500,
      );
    }
    if (!customer) {
      return jsonResponse({ error: "Cliente não encontrado." }, 404);
    }
    customerName = customer.name;
    customerPhone = customer.phone;
  }

  if (payload.serviceId) {
    const { data: service, error: serviceError } = await admin
      .from("services")
      .select("id")
      .eq("id", payload.serviceId)
      .eq("organization_id", caller.organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (serviceError) {
      return jsonResponse(
        { error: "Não foi possível validar o serviço." },
        500,
      );
    }
    if (!service) {
      return jsonResponse({ error: "Serviço não encontrado ou inativo." }, 404);
    }
  }

  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      customer_id: payload.customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      employee_id: payload.employeeId,
      end_time: payload.endTime,
      is_blocked: payload.isBlocked,
      notes: payload.notes,
      organization_id: caller.organizationId,
      service_id: payload.serviceId,
      start_time: payload.startTime,
      status: "pending",
    })
    .select(APPOINTMENT_FIELDS)
    .single();

  if (isScheduleConflict(error)) {
    return jsonResponse({ error: "Este horário não está disponível." }, 409);
  }
  if (error || !appointment) {
    return jsonResponse(
      { error: "Não foi possível criar o agendamento." },
      500,
    );
  }
  return jsonResponse({ appointment }, 201);
}

/**
 * Atualiza o status mediante uma transição de domínio permitida e sem sobrescrever alterações concorrentes.
 *
 * @author André Narcizo
 */
async function updateAppointmentStatus(
  admin: SupabaseClient,
  caller: CallerProfile,
  appointmentId: string,
  targetStatus: AppointmentStatus,
): Promise<Response> {
  const { data: appointment, error: appointmentError } = await getAppointment(
    admin,
    appointmentId,
    caller.organizationId,
  );
  if (appointmentError) {
    return jsonResponse(
      { error: "Não foi possível consultar o agendamento." },
      500,
    );
  }
  if (!appointment) {
    return jsonResponse({ error: "Agendamento não encontrado." }, 404);
  }
  if (!canManageAppointment(caller, appointment.employee_id)) {
    return jsonResponse({
      error: "Funcionários só podem gerenciar horários próprios.",
    }, 403);
  }

  const currentStatus = appointment.status as AppointmentStatus;
  if (
    !["pending", "confirmed"].includes(currentStatus) ||
    !ALLOWED_TRANSITIONS[currentStatus as "pending" | "confirmed"].includes(
      targetStatus,
    )
  ) {
    return jsonResponse({ error: "Transição de status não permitida." }, 409);
  }

  const { data: updated, error } = await admin
    .from("appointments")
    .update({ status: targetStatus })
    .eq("id", appointment.id)
    .eq("organization_id", caller.organizationId)
    .eq("status", currentStatus)
    .select(APPOINTMENT_FIELDS)
    .maybeSingle();

  if (isScheduleConflict(error)) {
    return jsonResponse({ error: "Este horário não está disponível." }, 409);
  }
  if (error) {
    return jsonResponse(
      { error: "Não foi possível atualizar o agendamento." },
      500,
    );
  }
  if (!updated) {
    return jsonResponse({
      error:
        "O agendamento foi alterado por outra operação. Atualize e tente novamente.",
    }, 409);
  }
  return jsonResponse({ appointment: updated });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("authorization");
    const payload = parsePayload(await request.json().catch(() => null));
    if (
      !url || !anonKey || !serviceRoleKey || !authorization ||
      !/^Bearer\s+\S+$/i.test(authorization)
    ) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }
    if (!payload) return jsonResponse({ error: "Dados inválidos." }, 400);

    const userClient = createUserClient(url, anonKey, authorization);
    const { data: { user }, error: userError } = await userClient.auth
      .getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const caller = await getCallerProfile(admin, user.id);
    if (!caller) {
      return jsonResponse({
        error: "Sem permissão para gerenciar agendamentos.",
      }, 403);
    }

    if (payload.action === "create") {
      return await createAppointment(admin, caller, payload);
    }
    if (payload.action === "cancel") {
      return await updateAppointmentStatus(
        admin,
        caller,
        payload.appointmentId,
        "cancelled",
      );
    }
    return await updateAppointmentStatus(
      admin,
      caller,
      payload.appointmentId,
      payload.status,
    );
  } catch (error: unknown) {
    console.error(
      "Erro ao gerenciar agendamento:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return jsonResponse(
      { error: "Não foi possível gerenciar o agendamento." },
      500,
    );
  }
});
