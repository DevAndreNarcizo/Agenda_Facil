import {
  hasValidSharedSecret,
  parseInternalWhatsAppRequest,
  requirePost,
} from "./integrations.ts";

/**
 * Garante igualdade explícita sem depender de bibliotecas de asserção externas.
 *
 * @author André Narcizo
 */
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("aceita apenas segredo interno idêntico", () => {
  assert(
    hasValidSharedSecret("segredo-interno", "segredo-interno"),
    "O segredo válido deveria ser aceito.",
  );
  assert(
    !hasValidSharedSecret("segredo-interno", "segredo-diferente"),
    "Segredos distintos não podem ser aceitos.",
  );
  assert(
    !hasValidSharedSecret(null, "segredo-interno"),
    "Cabeçalho ausente não pode ser aceito.",
  );
});

Deno.test("valida contrato restrito de template interno", () => {
  const payload = parseInternalWhatsAppRequest({
    recipientPhone: "+55 (62) 99999-9999",
    templateName: "appointment_reminder",
    parameters: ["Ana", "10:00", "Clínica"],
    correlationId: "2f7b1a21-5b03-4aa7-9067-9c7f44f91c01",
  });

  assert(
    payload?.recipientPhone === "5562999999999",
    "O telefone deveria ser normalizado.",
  );
  assert(
    payload?.parameters.length === 3,
    "Os parâmetros válidos deveriam ser preservados.",
  );
});

Deno.test("rejeita template, correlationId e parâmetros inválidos", () => {
  assert(
    parseInternalWhatsAppRequest({
      recipientPhone: "5562999999999",
      templateName: "arbitrary_message",
      parameters: ["conteúdo livre"],
      correlationId: "2f7b1a21-5b03-4aa7-9067-9c7f44f91c01",
    }) === null,
    "Templates fora da lista não podem ser aceitos.",
  );

  assert(
    parseInternalWhatsAppRequest({
      recipientPhone: "5562999999999",
      templateName: "portal_otp",
      parameters: ["123456"],
      correlationId: "not-a-uuid",
    }) === null,
    "CorrelationId inválido não pode ser aceito.",
  );

  assert(
    requirePost(new Request("https://agenda-facil.test", { method: "GET" }))
      ?.status === 405,
    "Método GET deve ser recusado.",
  );
});
