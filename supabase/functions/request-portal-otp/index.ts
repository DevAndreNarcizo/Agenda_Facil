import {
  corsHeaders,
  createAdminClient,
  createOtpCode,
  getRequestIp,
  hashSecret,
  jsonResponse,
  normalizePhone,
} from "../_shared/portal.ts";

const genericResponse = {
  message:
    "Se o número estiver cadastrado, o código será enviado pelo WhatsApp.",
};

/**
 * Responde ao preflight sem expor detalhes do fluxo de autenticação.
 *
 * @author André Narcizo
 */
function preflightResponse(): Response {
  return new Response("ok", { headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const { phone } = await request.json();
    const normalizedPhone = normalizePhone(phone);
    const admin = createAdminClient();
    if (!normalizedPhone || !admin) return jsonResponse(genericResponse, 202);

    const phoneHash = await hashSecret(normalizedPhone);
    const ipHash = await hashSecret(getRequestIp(request));
    if (!phoneHash || !ipHash) return jsonResponse(genericResponse, 202);

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [{ count: phoneCount }, { count: ipCount }] = await Promise.all([
      admin.from("portal_otp_requests").select("*", {
        count: "exact",
        head: true,
      }).eq("phone_hash", phoneHash).gte("created_at", since),
      admin.from("portal_otp_requests").select("*", {
        count: "exact",
        head: true,
      }).eq("ip_hash", ipHash).gte("created_at", since),
    ]);

    if ((phoneCount ?? 0) >= 3 || (ipCount ?? 0) >= 10) {
      return jsonResponse(genericResponse, 202);
    }

    await admin.from("portal_otp_requests").insert({
      phone_hash: phoneHash,
      ip_hash: ipHash,
    });

    const { data: customers } = await admin
      .from("customers")
      .select("id, organization_id")
      .eq("phone_normalized", normalizedPhone)
      .limit(2);

    if (!customers || customers.length !== 1) {
      return jsonResponse(genericResponse, 202);
    }

    const customer = customers[0];
    const code = createOtpCode();
    const codeHash = await hashSecret(code);
    const url = Deno.env.get("SUPABASE_URL");
    const internalSecret = Deno.env.get("WHATSAPP_INTERNAL_SECRET");
    if (!codeHash || !url || !internalSecret) {
      return jsonResponse(genericResponse, 202);
    }

    await admin
      .from("portal_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone_hash", phoneHash)
      .is("consumed_at", null);

    await admin.from("portal_otp_challenges").insert({
      code_hash: codeHash,
      customer_id: customer.id,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ip_hash: ipHash,
      organization_id: customer.organization_id,
      phone_hash: phoneHash,
    });

    await fetch(`${url}/functions/v1/send-whatsapp`, {
      body: JSON.stringify({
        recipientPhone: normalizedPhone,
        templateName: "portal_otp",
        parameters: [code],
        correlationId: crypto.randomUUID(),
      }),
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      method: "POST",
    });
  } catch {
    // Mantém uma resposta indistinguível para evitar enumeração de clientes.
  }

  return jsonResponse(genericResponse, 202);
});
