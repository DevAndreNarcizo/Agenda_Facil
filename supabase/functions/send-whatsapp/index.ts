import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

type WhatsAppPayload = {
  phone: string;
  message: string;
  type: 'template';
  templateName: 'appointment_reminder' | 'appointment_confirmation' | 'portal_otp';
};

/**
 * Valida a mensagem permitida no canal interno de WhatsApp.
 *
 * @author André Narcizo
 */
function parsePayload(value: unknown): WhatsAppPayload | null {
  if (!value || typeof value !== 'object') return null;
  const { phone, message, type, templateName } = value as Record<string, unknown>;
  if (typeof phone !== 'string' || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) return null;
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 1_000) return null;
  if (type !== 'template') return null;
  if (templateName !== 'appointment_reminder' && templateName !== 'appointment_confirmation' && templateName !== 'portal_otp') return null;
  return { phone: phone.replace(/\D/g, ''), message: message.trim(), type, templateName };
}

serve(async (request) => {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405 });

  const internalSecret = Deno.env.get('WHATSAPP_INTERNAL_SECRET');
  if (!internalSecret || request.headers.get('x-internal-secret') !== internalSecret) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 403 });
  }

  const token = Deno.env.get('WHATSAPP_CLOUD_API_TOKEN');
  const phoneNumberId = Deno.env.get('PHONE_NUMBER_ID');
  const payload = parsePayload(await request.json());
  if (!token || !phoneNumberId || !payload) return new Response(JSON.stringify({ error: 'Dados inválidos.' }), { status: 400 });

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: payload.phone,
        type: 'template',
        template: {
          name: payload.templateName,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: payload.message }] }],
        },
      }),
    });

    if (!response.ok) {
      console.error('Falha no provedor WhatsApp:', response.status);
      return new Response(JSON.stringify({ error: 'Falha ao enviar mensagem.' }), { status: 502 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Erro no WhatsApp:', error);
    return new Response(JSON.stringify({ error: 'Falha ao enviar mensagem.' }), { status: 500 });
  }
});
