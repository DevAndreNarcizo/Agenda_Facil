import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const WHATSAPP_FUNCTION_URL = Deno.env.get('WHATSAPP_FUNCTION_URL') || `${supabaseUrl}/functions/v1/send-whatsapp`

serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('REMINDERS_CRON_SECRET');
    if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar agendamentos que começam exatamente daqui a 24 horas (janela de 1 hora)
    const now = new Date();
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        customer_name,
        customer_phone,
        start_time,
        status,
        reminder_sent_at,
        organization_id,
        customer:customers(name, phone),
        organization:organizations(name)
      `)
      .eq('status', 'confirmed')
      .gte('start_time', startTime.toISOString())
      .lt('start_time', endTime.toISOString())
      .is('reminder_sent_at', null);

    if (error) throw error;

    console.log(`Found ${appointments?.length || 0} appointments for reminders.`)

    const results = [];

    for (const apt of (appointments || [])) {
      try {
        // Resolver nome e telefone do cliente (campo direto ou via relação)
        const customerData = Array.isArray(apt.customer) ? apt.customer[0] : apt.customer;
        const orgData = Array.isArray(apt.organization) ? apt.organization[0] : apt.organization;
        const customerName = apt.customer_name || customerData?.name || 'Cliente';
        const customerPhone = apt.customer_phone || customerData?.phone;
        const orgName = orgData?.name || 'nossa clínica';

        if (!customerPhone) {
          console.warn(`Appointment ${apt.id}: no phone number, skipping`);
          results.push({ id: apt.id, success: false, error: 'no_phone' });
          continue;
        }

        // Formatar horário no fuso de Brasília
        const appointmentTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });

        const message = `Olá ${customerName}! Passando para lembrar do seu agendamento amanhã às ${appointmentTime} na ${orgName}. Confirmado?`;

        // Chamar o canal interno autenticado de WhatsApp
        const internalSecret = Deno.env.get('WHATSAPP_INTERNAL_SECRET');
        if (!internalSecret) {
          console.error('Missing WHATSAPP_INTERNAL_SECRET');
          results.push({ id: apt.id, success: false, error: 'missing_internal_secret' });
          continue;
        }

        const response = await fetch(WHATSAPP_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': internalSecret
          },
          body: JSON.stringify({
            phone: customerPhone,
            message: message,
            type: 'template',
            templateName: 'appointment_reminder'
          })
        });

        if (response.ok) {
          // Marcar como lembrete enviado
          await supabase
            .from('appointments')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', apt.id);

          results.push({ id: apt.id, success: true });
        } else {
          let detail;
          try {
            detail = await response.json();
          } catch {
            detail = { status: response.status, statusText: response.statusText };
          }
          results.push({ id: apt.id, success: false, error: detail });
        }
      } catch (aptError) {
        console.error(`Error sending reminder for apt ${apt.id}:`, aptError);
        results.push({ id: apt.id, success: false, error: (aptError as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-reminders:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
