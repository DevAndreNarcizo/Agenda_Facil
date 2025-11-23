import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './whatsapp-session'
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let isReady = false;
let qrCodeData = null;

// Evento: QR Code gerado
client.on('qr', (qr) => {
  console.log('📱 QR Code gerado! Escaneie com seu WhatsApp:');
  qrcode.generate(qr, { small: true });
  qrCodeData = qr;
});

// Evento: Cliente pronto
client.on('ready', () => {
  console.log('✅ WhatsApp conectado e pronto!');
  isReady = true;
  qrCodeData = null;
});

// Evento: Autenticação bem-sucedida
client.on('authenticated', () => {
  console.log('🔐 Autenticado com sucesso!');
});

// Evento: Falha na autenticação
client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
  isReady = false;
});

// Evento: Desconectado
client.on('disconnected', (reason) => {
  console.log('⚠️ Desconectado:', reason);
  isReady = false;
});

// Inicializar cliente
client.initialize();

// Rota: Status do serviço
app.get('/status', (req, res) => {
  res.json({
    ready: isReady,
    qrCode: qrCodeData,
    message: isReady ? 'WhatsApp conectado' : 'Aguardando autenticação'
  });
});

// Rota: Enviar mensagem
app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message are required'
      });
    }

    if (!isReady) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp not connected. Please scan QR code first.',
        qrCode: qrCodeData
      });
    }

    // Formatar número (remover caracteres especiais e adicionar @c.us)
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `55${cleanPhone}@c.us`; // 55 = código do Brasil

    // Verificar se o número existe no WhatsApp
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
      return res.status(404).json({
        success: false,
        error: 'Phone number not registered on WhatsApp'
      });
    }

    // Enviar mensagem
    await client.sendMessage(chatId, message);

    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Enviar código OTP
app.post('/send-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone and code are required'
      });
    }

    if (!isReady) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp not connected',
        qrCode: qrCodeData
      });
    }

    const message = `🔐 *Agenda Fácil*\n\nSeu código de verificação é:\n\n*${code}*\n\nEste código expira em 5 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.`;

    // Reutilizar lógica de envio
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Tentar diferentes formatos de número
    const phoneFormats = [
      `${cleanPhone}@c.us`,           // Formato padrão
      `55${cleanPhone}@c.us`,         // Com código do Brasil
      `${cleanPhone}@s.whatsapp.net`  // Formato alternativo
    ];

    let sent = false;
    let lastError = null;

    for (const chatId of phoneFormats) {
      try {
        // Verificar se o número está registrado
        const isRegistered = await client.isRegisteredUser(chatId);
        
        if (isRegistered) {
          // Tentar enviar mensagem
          await client.sendMessage(chatId, message);
          sent = true;
          console.log(`✅ Mensagem enviada para ${chatId}`);
          break;
        }
      } catch (error) {
        lastError = error;
        console.log(`❌ Falha ao enviar para ${chatId}:`, error.message);
        continue;
      }
    }

    if (sent) {
      return res.json({
        success: true,
        message: 'OTP sent successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Phone number not found on WhatsApp or unable to send message',
        details: lastError?.message,
        suggestion: 'Certifique-se de que o número tem WhatsApp ativo e já teve alguma conversa com este número'
      });
    }

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Service rodando na porta ${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
});
