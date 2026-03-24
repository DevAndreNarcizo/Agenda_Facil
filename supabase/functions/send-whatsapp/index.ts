import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_CLOUD_API_TOKEN')
const PHONE_NUMBER_ID = Deno.env.get('PHONE_NUMBER_ID')

serve(async (req) => {
  try {
    const { phone, code, message, type = 'otp', templateName } = await req.json()

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Limpar número do telefone (padrão E.164 sem o +)
    const cleanPhone = phone.replace(/\D/g, '')

    let body;

    if (type === 'template') {
       // Enviar usando Template oficial (necessário para iniciar conversa)
       body = {
         messaging_product: "whatsapp",
         to: cleanPhone,
         type: "template",
         template: {
           name: templateName || "appointment_confirmation",
           language: { code: "pt_BR" },
           components: [
             {
               type: "body",
               parameters: [
                 { type: "text", text: message }
               ]
             }
           ]
         }
       }
    } else {
      // Enviar OTP ou Mensagem de Texto Simples
      // Nota: Cloud API exige templates se for fora da janela de 24h
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { 
          body: type === 'otp' 
            ? `🔐 Seu código de verificação Agenda Fácil é: ${code}`
            : message 
        }
      }
    }

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('WhatsApp API Error:', data)
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp', details: data }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-whatsapp:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
