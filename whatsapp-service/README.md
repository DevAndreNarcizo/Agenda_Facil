# WhatsApp Service

Serviço Node.js para envio de mensagens WhatsApp usando `whatsapp-web.js`.

## 🎯 Vantagens

- ✅ **100% Gratuito** - Sem custos de API
- ✅ **Sem Aprovação** - Não precisa de aprovação do Meta/WhatsApp
- ✅ **Fácil Setup** - Apenas escanear QR Code
- ✅ **Sem Limitações** - Envie para qualquer número

## 📋 Pré-requisitos

- Node.js 18+ instalado
- WhatsApp instalado no celular
- Conexão com internet estável

## 🚀 Instalação

### 1. Instalar Dependências

```bash
cd whatsapp-service
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite `.env` se necessário (porta padrão: 3001).

### 3. Iniciar Serviço

```bash
npm start
```

### 4. Escanear QR Code

1. Ao iniciar, um QR Code aparecerá no terminal
2. Abra WhatsApp no celular
3. Vá em **Configurações** > **Aparelhos Conectados**
4. Toque em **Conectar um aparelho**
5. Escaneie o QR Code

✅ Após escanear, o serviço estará pronto!

## 📡 API Endpoints

### GET /status

Verifica status da conexão.

**Resposta:**

```json
{
  "ready": true,
  "qrCode": null,
  "message": "WhatsApp conectado"
}
```

### POST /send-otp

Envia código OTP via WhatsApp.

**Request:**

```json
{
  "phone": "11999999999",
  "code": "123456"
}
```

**Resposta:**

```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### POST /send-message

Envia mensagem personalizada.

**Request:**

```json
{
  "phone": "11999999999",
  "message": "Sua mensagem aqui"
}
```

## 🔧 Integração com Supabase

Atualize a Edge Function para chamar este serviço:

```typescript
// supabase/functions/send-whatsapp/index.ts
const response = await fetch("http://localhost:3001/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone, code }),
});
```

## 🐛 Troubleshooting

### QR Code não aparece

- Verifique se a porta 3001 está livre
- Reinstale dependências: `npm install`

### "WhatsApp not connected"

- Escaneie o QR Code novamente
- Verifique conexão com internet

### Mensagem não chega

- Verifique se o número está no formato correto (apenas dígitos)
- Confirme que o número tem WhatsApp ativo

## 📱 Produção

### Opção 1: Servidor Dedicado

- Deploy em VPS (DigitalOcean, AWS, etc)
- Mantenha o serviço rodando com PM2

```bash
npm install -g pm2
pm2 start index.js --name whatsapp-service
pm2 save
pm2 startup
```

### Opção 2: Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## ⚠️ Limitações

- Requer que o celular esteja conectado à internet
- Se desconectar, precisa escanear QR Code novamente
- WhatsApp pode banir se detectar uso abusivo (envie com moderação)

## 💡 Dicas

- Use um número secundário para evitar ban
- Não envie spam
- Respeite limites de mensagens (max ~50/dia recomendado)
- Mantenha o serviço rodando 24/7
