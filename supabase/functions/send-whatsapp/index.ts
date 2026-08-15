import {
  hasValidSharedSecret,
  jsonResponse,
  logIntegrationEvent,
  parseInternalWhatsAppRequest,
  requirePost,
} from "../_shared/integrations.ts";

/**
 * Extrai o identificador devolvido pelo provedor sem registrar o payload recebido.
 *
 * @author André Narcizo
 */
function getProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("messages" in payload)) {
    return null;
  }
  const messages = (payload as { messages?: unknown }).messages;
  if (
    !Array.isArray(messages) || !messages[0] || typeof messages[0] !== "object"
  ) return null;
  const id = (messages[0] as { id?: unknown }).id;
  return typeof id === "string" && id.length <= 255 ? id : null;
}

Deno.serve(async (request) => {
  const methodError = requirePost(request);
  if (methodError) return methodError;

  const internalSecret = Deno.env.get("WHATSAPP_INTERNAL_SECRET");
  if (
    !hasValidSharedSecret(
      request.headers.get("x-internal-secret"),
      internalSecret,
    )
  ) {
    return jsonResponse({ error: "Não autorizado." }, 403);
  }

  const payload = parseInternalWhatsAppRequest(
    await request.json().catch(() => null),
  );
  const token = Deno.env.get("WHATSAPP_CLOUD_API_TOKEN");
  const phoneNumberId = Deno.env.get("PHONE_NUMBER_ID");
  if (!payload) return jsonResponse({ error: "Dados inválidos." }, 400);
  if (!token || !phoneNumberId) {
    logIntegrationEvent("whatsapp.send", "error", {
      deliveryId: payload.correlationId,
      errorCode: "missing_configuration",
    });
    return jsonResponse({ error: "Canal indisponível." }, 503);
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: payload.recipientPhone,
          type: "template",
          template: {
            name: payload.templateName,
            language: { code: "pt_BR" },
            components: [{
              type: "body",
              parameters: payload.parameters.map((text) => ({
                type: "text",
                text,
              })),
            }],
          },
        }),
      },
    );

    if (!response.ok) {
      logIntegrationEvent("whatsapp.send", "error", {
        deliveryId: payload.correlationId,
        providerStatus: response.status,
      });
      return jsonResponse({
        error: "Falha ao enviar mensagem.",
        providerStatus: response.status,
      }, response.status >= 500 ? 502 : 422);
    }

    const providerMessageId = getProviderMessageId(
      await response.json().catch(() => null),
    );
    logIntegrationEvent("whatsapp.send", "ok", {
      deliveryId: payload.correlationId,
      providerStatus: response.status,
    });
    return jsonResponse({ providerMessageId }, 200);
  } catch {
    logIntegrationEvent("whatsapp.send", "error", {
      deliveryId: payload.correlationId,
      errorCode: "provider_unreachable",
    });
    return jsonResponse({ error: "Falha ao enviar mensagem." }, 502);
  }
});
