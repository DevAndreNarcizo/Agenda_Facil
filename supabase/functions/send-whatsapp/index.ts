import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// URL do serviço WhatsApp local
const WHATSAPP_SERVICE_URL = Deno.env.get('WHATSAPP_SERVICE_URL') || 'http://localhost:3001'

serve(async (req) => {
  try {
    const { phone, code, type = 'otp' } = await req.json()

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone and code are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Chamar serviço WhatsApp local
    const endpoint = type === 'otp' ? '/send-otp' : '/send-message'
    const whatsappResponse = await fetch(`${WHATSAPP_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    })

    const whatsappData = await whatsappResponse.json()

    if (!whatsappResponse.ok) {
      console.error('WhatsApp service error:', whatsappData)
      
      // Se o serviço não estiver disponível, retornar código simulado
      if (whatsappResponse.status === 503) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Código gerado (WhatsApp offline)',
            simulated_code: code,
            warning: 'WhatsApp service not connected. Please scan QR code.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message',
          details: whatsappData 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'WhatsApp message sent successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-whatsapp function:', error)
    
    // Fallback para modo simulação
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Código gerado (modo desenvolvimento)',
        simulated_code: code || '000000',
        error: error.message
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
