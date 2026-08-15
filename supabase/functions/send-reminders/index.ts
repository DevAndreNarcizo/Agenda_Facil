import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hasValidSharedSecret,
  jsonResponse,
  logIntegrationEvent,
  requirePost,
} from "../_shared/integrations.ts";

type Delivery = { appointment_id: string; id: string; organization_id: string };
type AppointmentContext = {
  customer_name: string | null;
  customer_phone: string | null;
  id: string;
  start_time: string;
  customer:
    | { name: string; phone: string }
    | { name: string; phone: string }[]
    | null;
  organization: { name: string } | { name: string }[] | null;
};

/**
 * Resolve relações retornadas pelo Supabase sem depender da cardinalidade implícita.
 *
 * @author André Narcizo
 */
function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Retorna um limite de lote defensivo e previsível.
 *
 * @author André Narcizo
 */
function getBatchSize(): number {
  const configured = Number(Deno.env.get("REMINDERS_BATCH_SIZE") ?? "25");
  return Number.isInteger(configured) && configured >= 1 && configured <= 100
    ? configured
    : 25;
}

Deno.serve(async (request) => {
  const methodError = requirePost(request);
  if (methodError) return methodError;

  if (
    !hasValidSharedSecret(
      request.headers.get("x-cron-secret"),
      Deno.env.get("REMINDERS_CRON_SECRET"),
    )
  ) {
    return jsonResponse({ error: "Não autorizado." }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalSecret = Deno.env.get("WHATSAPP_INTERNAL_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
    logIntegrationEvent("reminders.run", "error", {
      errorCode: "missing_configuration",
    });
    return jsonResponse({ error: "Serviço indisponível." }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const now = new Date();
  const from = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const batchSize = getBatchSize();
  const whatsappFunctionUrl = Deno.env.get("WHATSAPP_FUNCTION_URL") ??
    `${supabaseUrl}/functions/v1/send-whatsapp`;

  const { data: candidates, error: candidatesError } = await supabase
    .from("appointments")
    .select("id, organization_id, start_time")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("start_time", from.toISOString())
    .lt("start_time", to.toISOString());

  if (candidatesError) {
    logIntegrationEvent("reminders.run", "error", {
      errorCode: "queue_lookup_failed",
    });
    return jsonResponse(
      { error: "Não foi possível processar lembretes." },
      500,
    );
  }

  const queueRows = (candidates ?? []).map((appointment) => ({
    appointment_id: appointment.id,
    channel: "whatsapp",
    organization_id: appointment.organization_id,
    scheduled_for: now.toISOString(),
    template_name: "appointment_reminder",
  }));

  if (queueRows.length > 0) {
    const { error: queueError } = await supabase
      .from("message_deliveries")
      .upsert(queueRows, {
        onConflict: "appointment_id,template_name",
        ignoreDuplicates: true,
      });

    if (queueError) {
      logIntegrationEvent("reminders.run", "error", {
        errorCode: "queue_insert_failed",
      });
      return jsonResponse(
        { error: "Não foi possível processar lembretes." },
        500,
      );
    }
  }

  const { data: deliveries, error: claimError } = await supabase.rpc(
    "claim_message_deliveries",
    { p_limit: batchSize },
  );
  if (claimError) {
    logIntegrationEvent("reminders.run", "error", {
      errorCode: "queue_claim_failed",
    });
    return jsonResponse(
      { error: "Não foi possível processar lembretes." },
      500,
    );
  }

  let sent = 0;
  let failed = 0;
  let unknown = 0;

  for (const delivery of (deliveries ?? []) as Delivery[]) {
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        "customer_name, customer_phone, id, start_time, customer:customers(name, phone), organization:organizations(name)",
      )
      .eq("id", delivery.appointment_id)
      .eq("organization_id", delivery.organization_id)
      .maybeSingle();

    if (appointmentError || !appointment) {
      await supabase.rpc("mark_message_delivery", {
        p_delivery_id: delivery.id,
        p_status: "failed",
        p_error_code: "appointment_not_found",
        p_provider_message_id: null,
      });
      failed += 1;
      continue;
    }

    const context = appointment as unknown as AppointmentContext;
    const customer = firstRelation(context.customer);
    const organization = firstRelation(context.organization);
    const customerName = context.customer_name ?? customer?.name;
    const customerPhone = context.customer_phone ?? customer?.phone;
    const organizationName = organization?.name;

    if (!customerName || !customerPhone || !organizationName) {
      await supabase.rpc("mark_message_delivery", {
        p_delivery_id: delivery.id,
        p_status: "failed",
        p_error_code: "missing_recipient_context",
        p_provider_message_id: null,
      });
      failed += 1;
      continue;
    }

    const appointmentTime = new Date(context.start_time).toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      },
    );

    try {
      const response = await fetch(
        whatsappFunctionUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body: JSON.stringify({
            recipientPhone: customerPhone,
            templateName: "appointment_reminder",
            parameters: [customerName, appointmentTime, organizationName],
            correlationId: delivery.id,
          }),
        },
      );
      const body = await response.json().catch(() => null) as {
        providerMessageId?: string | null;
      } | null;

      if (response.ok) {
        await Promise.all([
          supabase.rpc("mark_message_delivery", {
            p_delivery_id: delivery.id,
            p_status: "sent",
            p_error_code: null,
            p_provider_message_id: body?.providerMessageId ?? null,
          }),
          supabase.from("appointments").update({
            reminder_sent_at: new Date().toISOString(),
          }).eq("id", context.id).eq(
            "organization_id",
            delivery.organization_id,
          ),
        ]);
        sent += 1;
        continue;
      }

      const status: "failed" | "unknown" = response.status >= 500
        ? "unknown"
        : "failed";
      await supabase.rpc("mark_message_delivery", {
        p_delivery_id: delivery.id,
        p_status: status,
        p_error_code: `whatsapp_${response.status}`,
        p_provider_message_id: null,
      });
      if (status === "failed") {
        failed += 1;
      } else {
        unknown += 1;
      }
    } catch {
      await supabase.rpc("mark_message_delivery", {
        p_delivery_id: delivery.id,
        p_status: "unknown",
        p_error_code: "whatsapp_unreachable",
        p_provider_message_id: null,
      });
      unknown += 1;
    }
  }

  logIntegrationEvent("reminders.run", "ok", {
    attempt: (deliveries ?? []).length,
  });
  return jsonResponse({
    queued: queueRows.length,
    claimed: (deliveries ?? []).length,
    sent,
    failed,
    unknown,
  }, 200);
});
