import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";
import {
  hasUpdatedOrganization,
  jsonResponse,
  logIntegrationEvent,
  requirePost,
} from "../_shared/integrations.ts";

type PlanCode = "starter" | "pro" | "clinic";

/**
 * Extrai um identificador de referência Stripe sem depender de expansão do objeto.
 *
 * @author André Narcizo
 */
function getStripeReferenceId(reference: unknown): string | null {
  if (typeof reference === "string") return reference;
  if (
    reference && typeof reference === "object" && "id" in reference &&
    typeof reference.id === "string"
  ) return reference.id;
  return null;
}

/**
 * Aceita somente os planos internos que possuem Price ID controlado pelo servidor.
 *
 * @author André Narcizo
 */
function parsePlanCode(value: unknown): PlanCode | null {
  return value === "starter" || value === "pro" || value === "clinic"
    ? value
    : null;
}

/**
 * Verifica identificadores UUID recebidos exclusivamente de metadata assinada.
 *
 * @author André Narcizo
 */
function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

/**
 * Converte o TTL do claim em intervalo seguro para o PostgreSQL.
 *
 * @author André Narcizo
 */
function getClaimStaleAfter(): string {
  const seconds = Number(
    Deno.env.get("INTEGRATIONS_CLAIM_TTL_SECONDS") ?? "600",
  );
  return Number.isInteger(seconds) && seconds >= 60 && seconds <= 3600
    ? `${seconds} seconds`
    : "10 minutes";
}

serve(async (request) => {
  const methodError = requirePost(request);
  if (methodError) return methodError;

  const signature = request.headers.get("stripe-signature");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (
    !signature || !supabaseUrl || !serviceRoleKey || !stripeSecretKey ||
    !webhookSecret
  ) {
    return jsonResponse({ error: "Webhook indisponível." }, 400);
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    logIntegrationEvent("stripe.webhook", "error", {
      errorCode: "invalid_signature",
    });
    return jsonResponse({ error: "Webhook inválido." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: claimStatus, error: claimError } = await supabase.rpc(
    "claim_webhook_event",
    {
      p_provider: "stripe",
      p_provider_event_id: event.id,
      p_event_type: event.type,
      p_stale_after: getClaimStaleAfter(),
    },
  );

  if (claimError || !claimStatus) {
    logIntegrationEvent("stripe.webhook", "error", {
      eventId: event.id,
      errorCode: "ledger_claim_failed",
    });
    return jsonResponse({ error: "Webhook indisponível." }, 500);
  }
  if (claimStatus === "processed") {
    return jsonResponse({ received: true, duplicate: true }, 200);
  }
  if (claimStatus === "processing") {
    return jsonResponse({ received: true, processing: true }, 202);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organization_id;
      const planCode = parsePlanCode(session.metadata?.plan_code);
      if (!isUuid(organizationId) || !planCode) {
        throw new Error("invalid_checkout_metadata");
      }

      const { data, error } = await supabase
        .from("organizations")
        .update({
          plan_name: planCode,
          stripe_customer_id: getStripeReferenceId(session.customer),
          stripe_subscription_id: getStripeReferenceId(session.subscription),
          subscription_status: "active",
        })
        .eq("id", organizationId)
        .select("id")
        .maybeSingle();
      if (!hasUpdatedOrganization(data, error)) {
        throw new Error("organization_update_failed");
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const { data, error } = await supabase
        .from("organizations")
        .update({
          subscription_status: event.type === "customer.subscription.deleted"
            ? "cancelled"
            : subscription.status,
        })
        .eq("stripe_subscription_id", subscription.id)
        .select("id")
        .maybeSingle();
      if (!hasUpdatedOrganization(data, error)) {
        throw new Error("subscription_update_failed");
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getStripeReferenceId(invoice.subscription);
      if (subscriptionId) {
        const { data, error } = await supabase
          .from("organizations")
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId)
          .select("id")
          .maybeSingle();
        if (!hasUpdatedOrganization(data, error)) {
          throw new Error("invoice_update_failed");
        }
      }
    }

    const { error: markError } = await supabase.rpc("mark_webhook_event", {
      p_provider: "stripe",
      p_provider_event_id: event.id,
      p_status: "processed",
      p_error_code: null,
    });
    if (markError) throw new Error("ledger_mark_failed");

    logIntegrationEvent("stripe.webhook", "ok", { eventId: event.id });
    return jsonResponse({ received: true }, 200);
  } catch (error: unknown) {
    const errorCode = error instanceof Error && /^[a-z_]+$/.test(error.message)
      ? error.message
      : "processing_failed";
    await supabase.rpc("mark_webhook_event", {
      p_provider: "stripe",
      p_provider_event_id: event.id,
      p_status: "failed",
      p_error_code: errorCode,
    });
    logIntegrationEvent("stripe.webhook", "error", {
      eventId: event.id,
      errorCode,
    });
    return jsonResponse({ error: "Webhook não processado." }, 500);
  }
});
