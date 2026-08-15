export const WHATSAPP_TEMPLATE_NAMES = [
  "appointment_reminder",
  "appointment_confirmation",
  "portal_otp",
] as const;

export type WhatsAppTemplateName = typeof WHATSAPP_TEMPLATE_NAMES[number];
export type DeliveryStatus = "sent" | "failed" | "unknown";

export type InternalWhatsAppRequest = {
  recipientPhone: string;
  templateName: WhatsAppTemplateName;
  parameters: string[];
  correlationId: string;
};

type JsonBody = Record<string, unknown>;

/**
 * Retorna uma resposta JSON consistente sem detalhes sensíveis.
 *
 * @author André Narcizo
 */
export function jsonResponse(body: JsonBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Recusa métodos diferentes de POST para endpoints internos.
 *
 * @author André Narcizo
 */
export function requirePost(request: Request): Response | null {
  return request.method === "POST"
    ? null
    : jsonResponse({ error: "Método não permitido." }, 405);
}

/**
 * Compara segredo compartilhado sem interrupção antecipada por conteúdo.
 *
 * @author André Narcizo
 */
export function hasValidSharedSecret(
  received: string | null,
  expected: string | undefined,
): boolean {
  if (!received || !expected) return false;

  const encoder = new TextEncoder();
  const receivedBytes = encoder.encode(received);
  const expectedBytes = encoder.encode(expected);
  const length = Math.max(receivedBytes.length, expectedBytes.length);
  let mismatch = receivedBytes.length ^ expectedBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (receivedBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return mismatch === 0;
}

/**
 * Faz parse restritivo do contrato permitido entre workers internos.
 *
 * @author André Narcizo
 */
export function parseInternalWhatsAppRequest(
  value: unknown,
): InternalWhatsAppRequest | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as Record<string, unknown>;
  const recipientPhone = typeof payload.recipientPhone === "string"
    ? payload.recipientPhone.replace(/\D/g, "")
    : "";
  const templateName = payload.templateName;
  const correlationId = typeof payload.correlationId === "string"
    ? payload.correlationId.trim()
    : "";
  const parameters = Array.isArray(payload.parameters)
    ? payload.parameters
    : [];

  if (
    !/^\d{10,15}$/.test(recipientPhone) ||
    !WHATSAPP_TEMPLATE_NAMES.includes(templateName as WhatsAppTemplateName) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(correlationId) ||
    parameters.length > 4 ||
    parameters.some((parameter) =>
      typeof parameter !== "string" || parameter.trim().length === 0 ||
      parameter.length > 160
    )
  ) {
    return null;
  }

  return {
    recipientPhone,
    templateName: templateName as WhatsAppTemplateName,
    parameters: parameters.map((parameter) => (parameter as string).trim()),
    correlationId,
  };
}

/**
 * Confirma que uma mutação de organização afetou exatamente um registro retornado pelo Supabase.
 *
 * @author André Narcizo
 */
export function hasUpdatedOrganization(data: unknown, error: unknown): boolean {
  return error === null &&
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string";
}

/**
 * Emite apenas contexto operacional não sensível para logs de integração.
 *
 * @author André Narcizo
 */
export function logIntegrationEvent(
  operation: string,
  status: "ok" | "error",
  context: Record<string, string | number | undefined> = {},
): void {
  const allowedContext = Object.fromEntries(
    Object.entries(context).filter(([key, value]) => (
      value !== undefined &&
      [
        "deliveryId",
        "eventId",
        "organizationId",
        "providerStatus",
        "errorCode",
        "attempt",
      ].includes(key)
    )),
  );

  console.log(
    JSON.stringify({ integration: operation, status, ...allowedContext }),
  );
}
