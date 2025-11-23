# Guia de Configuração: Twilio WhatsApp

## Passo 1: Criar Conta Twilio

1. Acesse [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Crie uma conta gratuita (trial)
3. Verifique seu número de telefone

## Passo 2: Configurar WhatsApp Sandbox

1. No Dashboard do Twilio, vá para **Messaging** > **Try it out** > **Send a WhatsApp message**
2. Siga as instruções para ativar o Sandbox:
   - Envie uma mensagem WhatsApp para o número fornecido
   - A mensagem deve ser: `join <seu-código-sandbox>`
   - Exemplo: `join happy-tiger`
3. Anote o número do Sandbox (formato: `whatsapp:+14155238886`)

## Passo 3: Obter Credenciais

1. No Dashboard, vá para **Account** > **API keys & tokens**
2. Copie:
   - **Account SID** (ex: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (clique em "Show" para revelar)

## Passo 4: Configurar Supabase Edge Function

### 4.1 Instalar Supabase CLI (se ainda não tiver)

```bash
npm install -g supabase
```

### 4.2 Fazer Login

```bash
supabase login
```

### 4.3 Link com seu Projeto

```bash
cd "c:\Projetos André\Agenda_Fácil\Agenda_Facil"
supabase link --project-ref SEU_PROJECT_REF
```

> **Nota**: Encontre seu `PROJECT_REF` na URL do dashboard: `https://supabase.com/dashboard/project/SEU_PROJECT_REF`

### 4.4 Configurar Secrets (Variáveis de Ambiente)

```bash
# Account SID
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Auth Token
supabase secrets set TWILIO_AUTH_TOKEN=seu_auth_token_aqui

# WhatsApp From (número do sandbox)
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 4.5 Deploy da Edge Function

```bash
supabase functions deploy send-whatsapp
```

## Passo 5: Aplicar Migração SQL

No Dashboard do Supabase > SQL Editor, execute:

```sql
-- Arquivo: 05_update_otp_with_whatsapp.sql
-- (Conteúdo já criado no arquivo)
```

## Passo 6: Testar

1. Acesse `/portal/login`
2. Digite um número de telefone (que tenha ativado o Sandbox)
3. Clique em "Enviar Código"
4. Verifique se recebeu a mensagem no WhatsApp

## Troubleshooting

### Erro: "Twilio account not authorized"

- Certifique-se de que o número de telefone ativou o Sandbox
- Verifique se as credenciais estão corretas

### Erro: "Edge Function not found"

- Execute `supabase functions deploy send-whatsapp` novamente
- Verifique se o link do projeto está correto

### Código não chega no WhatsApp

- Verifique os logs da Edge Function:
  ```bash
  supabase functions logs send-whatsapp
  ```
- Confirme que o número está no formato correto (+55XXXXXXXXXXX)

## Produção: WhatsApp Business API

Para usar em produção (sem sandbox):

1. **Solicitar Acesso**: [Twilio WhatsApp Business](https://www.twilio.com/whatsapp/request-access)
2. **Aprovar Template de Mensagem**: Twilio requer aprovação de templates
3. **Atualizar Edge Function**: Usar template aprovado
4. **Remover limitação de Sandbox**: Poderá enviar para qualquer número

### Template de Mensagem Aprovado (Exemplo)

```
Seu código de verificação para {{1}} é: {{2}}. Válido por {{3}} minutos.
```

Parâmetros:

- `{{1}}`: Nome do app ("Agenda Fácil")
- `{{2}}`: Código
- `{{3}}`: Tempo de expiração

## Custos

- **Trial**: Grátis, mas limitado ao Sandbox
- **Produção**: ~$0.005 por mensagem (varia por país)
- **Número WhatsApp Business**: ~$15/mês

## Alternativas

Se preferir outra solução:

- **MessageBird**: Similar ao Twilio
- **WhatsApp Business API Oficial**: Mais complexo, requer aprovação Meta
- **SMS (fallback)**: Usar Twilio SMS se WhatsApp falhar
