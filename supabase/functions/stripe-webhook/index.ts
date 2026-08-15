import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.9.0?target=deno';

/**
 * Extrai o identificador de uma referência Stripe que pode vir expandida.
 *
 * @author André Narcizo
 */
function getStripeReferenceId(reference: string | Stripe.ApiList<Stripe.SubscriptionItem> | Stripe.Subscription | null): string | null {
  if (typeof reference === 'string') return reference;
  if (reference && 'id' in reference) return reference.id;
  return null;
}

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  const signature = request.headers.get('stripe-signature');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !supabaseUrl || !serviceRoleKey || !stripeSecretKey || !webhookSecret) {
    return new Response('Configuração inválida', { status: 400 });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });
    const event = await stripe.webhooks.constructEventAsync(await request.text(), signature, webhookSecret);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: processedEvent, error: lookupError } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'stripe')
      .eq('provider_event_id', event.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (processedEvent) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const organizationId = session.metadata?.organization_id;
      const planCode = session.metadata?.plan_code ?? 'starter';
      if (!organizationId) throw new Error('Evento de checkout sem organization_id.');

      const { error } = await supabase.from('organizations').update({
        plan_name: planCode,
        stripe_customer_id: getStripeReferenceId(session.customer),
        stripe_subscription_id: getStripeReferenceId(session.subscription),
        subscription_status: 'active',
      }).eq('id', organizationId);
      if (error) throw error;
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const { error } = await supabase.from('organizations').update({
        subscription_status: event.type === 'customer.subscription.deleted' ? 'cancelled' : subscription.status,
      }).eq('stripe_subscription_id', subscription.id);
      if (error) throw error;
    }

    if (event.type === 'invoice.payment_failed') {
      const subscriptionId = getStripeReferenceId(event.data.object.subscription);
      if (subscriptionId) {
        const { error } = await supabase.from('organizations').update({ subscription_status: 'past_due' }).eq('stripe_subscription_id', subscriptionId);
        if (error) throw error;
      }
    }

    const { error: eventError } = await supabase.from('webhook_events').insert({
      provider: 'stripe',
      provider_event_id: event.id,
      event_type: event.type,
    });
    if (eventError) throw eventError;

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: unknown) {
    console.error('Erro no webhook Stripe:', error);
    return new Response('Webhook inválido', { status: 400 });
  }
});
