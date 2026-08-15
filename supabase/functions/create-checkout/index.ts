import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.9.0?target=deno';

type PlanCode = 'starter' | 'pro' | 'clinic';

/**
 * Monta cabeçalhos CORS apenas para a aplicação configurada.
 *
 * @author André Narcizo
 */
function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = Deno.env.get('APP_URL') ?? '';
  return {
    'Access-Control-Allow-Origin': origin === allowedOrigin ? allowedOrigin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/**
 * Obtém o Price ID exclusivamente de variáveis de ambiente controladas pelo servidor.
 *
 * @author André Narcizo
 */
function getPriceId(planCode: PlanCode): string | null {
  const prices: Record<PlanCode, string | undefined> = {
    starter: Deno.env.get('STRIPE_PRICE_STARTER'),
    pro: Deno.env.get('STRIPE_PRICE_PRO'),
    clinic: Deno.env.get('STRIPE_PRICE_CLINIC'),
  };

  return prices[planCode] ?? null;
}

/**
 * Valida o corpo público aceito pelo endpoint de checkout.
 *
 * @author André Narcizo
 */
function getPlanCode(payload: unknown): PlanCode | null {
  if (!payload || typeof payload !== 'object' || !('planCode' in payload)) {
    return null;
  }

  const planCode = payload.planCode;
  return planCode === 'starter' || planCode === 'pro' || planCode === 'clinic' ? planCode : null;
}

serve(async (request) => {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const appUrl = Deno.env.get('APP_URL');
    const authorization = request.headers.get('authorization');

    if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !appUrl || !authorization) {
      throw new Error('Configuração obrigatória ausente.');
    }

    const planCode = getPlanCode(await request.json());
    const priceId = planCode ? getPriceId(planCode) : null;
    if (!planCode || !priceId) {
      return new Response(JSON.stringify({ error: 'Plano indisponível.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id || profile.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Apenas o proprietário pode administrar a assinatura.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'pix'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: `${appUrl}/dashboard/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/subscription?checkout=cancelled`,
      metadata: { organization_id: profile.organization_id, plan_code: planCode },
      subscription_data: { trial_period_days: 14, metadata: { organization_id: profile.organization_id, plan_code: planCode } },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Erro ao criar checkout:', error);
    return new Response(JSON.stringify({ error: 'Não foi possível iniciar o checkout.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
