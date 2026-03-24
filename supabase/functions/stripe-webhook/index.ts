import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.9.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
if (!stripeKey) console.error('Missing STRIPE_SECRET_KEY')

const stripe = new Stripe(stripeKey, {
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    if (!endpointSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)

    console.log(`Event received: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const organizationId = session.metadata?.companyId || session.metadata?.organizationId
        const planName = session.metadata?.planName || 'professional'

        if (organizationId) {
          const { error } = await supabase
            .from('organizations')
            .update({
              plan_name: planName,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              subscription_status: 'active',
            })
            .eq('id', organizationId)

          if (error) {
            console.error('Error updating organization:', error)
            throw error
          }
          console.log(`Subscription activated for Organization: ${organizationId}`)
        } else {
          console.warn('No organizationId in session metadata')
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const status = subscription.status // active, past_due, canceled, etc.

        const { error } = await supabase
          .from('organizations')
          .update({
            subscription_status: status,
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription status:', error)
          throw error
        }
        console.log(`Subscription updated: ${subscription.id} -> ${status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object

        const { error } = await supabase
          .from('organizations')
          .update({
            subscription_status: 'cancelled',
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error cancelling subscription:', error)
          throw error
        }
        console.log(`Subscription cancelled: ${subscription.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription

        if (subscriptionId) {
          const { error } = await supabase
            .from('organizations')
            .update({
              subscription_status: 'past_due',
            })
            .eq('stripe_subscription_id', subscriptionId)

          if (error) console.error('Error updating past_due status:', error)
          console.log(`Payment failed for subscription: ${subscriptionId}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })

  } catch (error) {
    console.error(`Webhook Error: ${(error as Error).message}`)
    return new Response(`Webhook Error: ${(error as Error).message}`, { status: 400 })
  }
})
