import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import {
  hasValidSharedSecret,
  jsonResponse,
  logIntegrationEvent,
  requirePost,
} from "../_shared/integrations.ts";

type Delivery = {
  appointment_id: string;
  id: string;
  lock_token: string;
  organization_id: string;
};
type DeliveryFinalStatus = "failed" | "skipped" | "unknown";
type AppointmentContext = {
  customer_name: string | null;
  customer_phone: string | null;
  id: string;
  organization_id: string;
  start_time: string;
  status: string;
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

/**
 * Converte o TTL de recuperação de locks em um intervalo seguro para o PostgreSQL.
 *
 * @author André Narcizo
 */
function getLockTtlSeconds(): number {
  const seconds = Number(
    Deno.env.get("INTEGRATIONS_CLAIM_TTL_SECONDS") ?? "600",
  );
  return Number.isInteger(seconds) && seconds >= 450 && seconds <= 3600
    ? seconds
    : 600;
}

/**
 * Converte o TTL de lock em intervalo aceito pela RPC.
 *
 * @author André Narcizo
 */
function getLockTtlInterval(seconds: number): string {
  return `${seconds} seconds`;
}

/**
 * Mantém a chamada externa curta em relação ao lease da entrega.
 *
 * @author André Narcizo
 */
function getWhatsAppTimeoutMs(lockTtlSeconds: number): number {
  return Math.min(30_000, Math.max(1_000, (lockTtlSeconds - 10) * 1_000));
}

/**
 * Finaliza uma entrega sem ocultar falhas de persistência.
 *
 * @author André Narcizo
 */
async function markDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  lockToken: string,
  status: DeliveryFinalStatus,
  errorCode: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_reminder_delivery", {
    p_delivery_id: deliveryId,
    p_lock_token: lockToken,
    p_status: status,
    p_error_code: errorCode,
  });

  if (!error && data === true) return true;

  logIntegrationEvent("reminders.delivery", "error", {
    errorCode: error ? "delivery_mark_failed" : "delivery_lease_lost",
  });
  return false;
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
  const lockTtlSeconds = getLockTtlSeconds();
  const lockTtlInterval = getLockTtlInterval(lockTtlSeconds);
  const whatsappTimeoutMs = getWhatsAppTimeoutMs(lockTtlSeconds);
  const whatsappFunctionUrl = Deno.env.get("WHATSAPP_FUNCTION_URL") ??
    `${supabaseUrl}/functions/v1/send-whatsapp`;

  const { data: candidates, error: candidatesError } = await supabase
    .from("appointments")
    .select("id, organization_id, start_time")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("start_time", from.toISOString())
    .lt("start_time", to.toISOString())
    .limit(batchSize);

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
    "claim_reminder_deliveries",
    {
      p_limit: batchSize,
      p_lock_ttl: lockTtlInterval,
    },
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

  const claimedDeliveries = (deliveries ?? []) as Delivery[];
  const appointmentIds = [
    ...new Set(claimedDeliveries.map((delivery) => delivery.appointment_id)),
  ];
  const { data: appointments, error: appointmentsError } =
    appointmentIds.length === 0
      ? { data: [] as AppointmentContext[], error: null }
      : await supabase
        .from("appointments")
        .select(
          "customer_name, customer_phone, id, organization_id, start_time, status, customer:customers(name, phone), organization:organizations(name)",
        )
        .in("id", appointmentIds);

  if (appointmentsError) {
    logIntegrationEvent("reminders.run", "error", {
      errorCode: "appointment_context_lookup_failed",
    });
    return jsonResponse(
      { error: "Não foi possível processar lembretes." },
      500,
    );
  }

  const appointmentsById = new Map(
    (appointments ?? []).map((appointment) => [
      appointment.id,
      appointment as unknown as AppointmentContext,
    ]),
  );
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let unknown = 0;
  let persistenceFailures = 0;

  for (const delivery of claimedDeliveries) {
    const context = appointmentsById.get(delivery.appointment_id);

    if (!context || context.organization_id !== delivery.organization_id) {
      if (
        await markDelivery(
          supabase,
          delivery.id,
          delivery.lock_token,
          "failed",
          "appointment_not_found",
        )
      ) {
        failed += 1;
      } else {
        persistenceFailures += 1;
      }
      continue;
    }

    if (context.status !== "confirmed") {
      if (
        await markDelivery(
          supabase,
          delivery.id,
          delivery.lock_token,
          "skipped",
          "appointment_not_confirmed",
        )
      ) {
        skipped += 1;
      } else {
        persistenceFailures += 1;
      }
      continue;
    }
    const customer = firstRelation(context.customer);
    const organization = firstRelation(context.organization);
    const customerName = context.customer_name ?? customer?.name;
    const customerPhone = context.customer_phone ?? customer?.phone;
    const organizationName = organization?.name;

    if (!customerName || !customerPhone || !organizationName) {
      if (
        await markDelivery(
          supabase,
          delivery.id,
          delivery.lock_token,
          "failed",
          "missing_recipient_context",
        )
      ) {
        failed += 1;
      } else {
        persistenceFailures += 1;
      }
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

    const { data: leaseRenewed, error: leaseError } = await supabase.rpc(
      "renew_reminder_delivery_lease",
      {
        p_delivery_id: delivery.id,
        p_lock_token: delivery.lock_token,
        p_lock_ttl: lockTtlInterval,
      },
    );
    if (leaseError || leaseRenewed !== true) {
      logIntegrationEvent("reminders.delivery", "error", {
        errorCode: leaseError
          ? "delivery_lease_renew_failed"
          : "delivery_lease_lost",
      });
      persistenceFailures += 1;
      continue;
    }

    try {
      const response = await fetch(
        whatsappFunctionUrl,
        {
          method: "POST",
          signal: AbortSignal.timeout(whatsappTimeoutMs),
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
        const { data: completion, error: completionError } = await supabase.rpc(
          "complete_reminder_delivery",
          {
            p_delivery_id: delivery.id,
            p_appointment_id: context.id,
            p_organization_id: delivery.organization_id,
            p_lock_token: delivery.lock_token,
            p_provider_message_id: body?.providerMessageId ?? null,
          },
        );

        if (completionError || completion !== "sent") {
          if (completionError) {
            const marked = await markDelivery(
              supabase,
              delivery.id,
              delivery.lock_token,
              "unknown",
              "delivery_confirmation_failed",
            );
            persistenceFailures += marked ? 0 : 1;
          }
          unknown += 1;
          continue;
        }

        sent += 1;
        continue;
      }

      const status: DeliveryFinalStatus = response.status >= 500
        ? "unknown"
        : "failed";
      if (
        await markDelivery(
          supabase,
          delivery.id,
          delivery.lock_token,
          status,
          `whatsapp_${response.status}`,
        )
      ) {
        if (status === "failed") {
          failed += 1;
        } else {
          unknown += 1;
        }
      } else {
        persistenceFailures += 1;
      }
    } catch {
      if (
        await markDelivery(
          supabase,
          delivery.id,
          delivery.lock_token,
          "unknown",
          "whatsapp_unreachable",
        )
      ) {
        unknown += 1;
      } else {
        persistenceFailures += 1;
      }
    }
  }

  if (persistenceFailures > 0) {
    logIntegrationEvent("reminders.run", "error", {
      attempt: (deliveries ?? []).length,
      errorCode: "delivery_persistence_failed",
    });
    return jsonResponse({
      error: "Não foi possível registrar todas as entregas.",
    }, 500);
  }

  logIntegrationEvent("reminders.run", "ok", {
    attempt: (deliveries ?? []).length,
  });
  return jsonResponse({
    queued: queueRows.length,
    claimed: (deliveries ?? []).length,
    sent,
    failed,
    skipped,
    unknown,
  }, 200);
});
