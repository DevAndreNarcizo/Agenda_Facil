import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type ProfileRole = "owner" | "admin" | "employee";
type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

type CreateCommand = {
  action: "create";
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  employeeId: string | null;
  notes: string | null;
  serviceId: string;
  startTime: string;
};

type RescheduleCommand = {
  action: "reschedule";
  appointmentId: string;
  employeeId: string | null;
  serviceId: string;
  startTime: string;
};

type UpdateStatusCommand = {
  action: "update-status";
  appointmentId: string;
  status: AppointmentStatus;
};

type CancelCommand = {
  action: "cancel";
  appointmentId: string;
};

type CreateBlockCommand = {
  action: "create-block";
  employeeId: string | null;
  endTime: string;
  reason: string | null;
  startTime: string;
};

type DeleteBlockCommand = {
  action: "delete-block";
  blockId: string;
};

type AppointmentCommand =
  | CreateCommand
  | RescheduleCommand
  | UpdateStatusCommand
  | CancelCommand
  | CreateBlockCommand
  | DeleteBlockCommand;

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ALLOWED_ROLES = new Set<ProfileRole>(["owner", "admin", "employee"]);

/**
 * Retorna uma resposta JSON consistente para o painel autenticado.
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
 * Confere o formato UUID recebido em um comando de agenda.
 *
 * @author André Narcizo
 */
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Normaliza texto opcional e limita seu tamanho antes de encaminhar ao banco.
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
    : normalized.length === 0
    ? null
    : undefined;
}

/**
 * Valida data ISO com offset explícito e devolve a representação UTC canônica.
 *
 * @author André Narcizo
 */
function parseDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATE_TIME_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Converte valores UUID opcionais sem permitir strings fora do contrato.
 *
 * @author André Narcizo
 */
function parseOptionalUuid(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return isUuid(value) ? value : undefined;
}

/**
 * Valida o payload de criação. A duração é sempre calculada pela RPC no servidor.
 *
 * @author André Narcizo
 */
function parseCreateCommand(
  data: Record<string, unknown>,
): CreateCommand | null {
  const customerId = parseOptionalUuid(data.customerId);
  const employeeId = parseOptionalUuid(data.employeeId);
  const customerName = parseOptionalText(data.customerName, 160);
  const customerPhone = parseOptionalText(data.customerPhone, 30);
  const notes = parseOptionalText(data.notes, 2_000);
  const startTime = parseDateTime(data.startTime);

  if (
    customerId === undefined || employeeId === undefined ||
    customerName === undefined ||
    customerPhone === undefined || notes === undefined ||
    !isUuid(data.serviceId) ||
    !startTime || (customerId === null && !customerName)
  ) return null;

  return {
    action: "create",
    customerId,
    customerName,
    customerPhone,
    employeeId,
    notes,
    serviceId: data.serviceId,
    startTime,
  };
}

/**
 * Valida comandos de agenda e mantém somente os campos aceitos por cada ação.
 *
 * @author André Narcizo
 */
function parseCommand(value: unknown): AppointmentCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;

  if (data.action === "create") return parseCreateCommand(data);

  if (data.action === "reschedule") {
    const employeeId = parseOptionalUuid(data.employeeId);
    const startTime = parseDateTime(data.startTime);
    if (
      isUuid(data.appointmentId) && isUuid(data.serviceId) &&
      employeeId !== undefined && startTime
    ) {
      return {
        action: "reschedule",
        appointmentId: data.appointmentId,
        employeeId,
        serviceId: data.serviceId,
        startTime,
      };
    }
  }

  if (data.action === "update-status" && isUuid(data.appointmentId)) {
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

  if (data.action === "cancel" && isUuid(data.appointmentId)) {
    return { action: "cancel", appointmentId: data.appointmentId };
  }

  if (data.action === "create-block") {
    const employeeId = parseOptionalUuid(data.employeeId);
    const startTime = parseDateTime(data.startTime);
    const endTime = parseDateTime(data.endTime);
    const reason = parseOptionalText(data.reason, 500);
    if (
      employeeId !== undefined && reason !== undefined && startTime &&
      endTime &&
      new Date(endTime).getTime() > new Date(startTime).getTime()
    ) {
      return { action: "create-block", employeeId, endTime, reason, startTime };
    }
  }

  if (data.action === "delete-block" && isUuid(data.blockId)) {
    return { action: "delete-block", blockId: data.blockId };
  }

  return null;
}

/**
 * Cria um cliente que revalida o JWT enviado pelo browser.
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
 * Confirma que o usuário autenticado possui perfil operacional válido.
 *
 * @author André Narcizo
 */
async function hasOperationalProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return !error && Boolean(data && ALLOWED_ROLES.has(data.role as ProfileRole));
}

/**
 * Converte erros PostgreSQL da RPC em status HTTP estáveis para a interface.
 *
 * @author André Narcizo
 */
function rpcErrorResponse(
  error: { code?: string; message?: string },
): Response {
  const status = error.code === "23P01"
    ? 409
    : error.code === "42501"
    ? 403
    : error.code === "P0001"
    ? 404
    : error.code === "22023"
    ? 400
    : 500;
  return jsonResponse(
    { error: error.message || "Não foi possível gerenciar o agendamento." },
    status,
  );
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
    const command = parseCommand(await request.json().catch(() => null));

    if (
      !url || !anonKey || !serviceRoleKey || !authorization ||
      !/^Bearer\s+\S+$/i.test(authorization)
    ) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }
    if (!command) return jsonResponse({ error: "Dados inválidos." }, 400);

    const userClient = createUserClient(url, anonKey, authorization);
    const { data: { user }, error: userError } = await userClient.auth
      .getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
    if (!await hasOperationalProfile(admin, user.id)) {
      return jsonResponse({
        error: "Sem permissão para gerenciar agendamentos.",
      }, 403);
    }

    const { data, error } = await admin.rpc("manage_appointment_command", {
      p_actor_id: user.id,
      p_payload: command,
    });

    if (error) return rpcErrorResponse(error);
    return jsonResponse(data);
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
