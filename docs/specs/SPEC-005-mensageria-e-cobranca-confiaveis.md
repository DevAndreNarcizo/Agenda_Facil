# SPEC-005 — Mensageria e cobrança confiáveis

**Status:** implementada no ambiente de teste; configuração externa pendente
**Prioridade:** P1

## Objetivo

Operar Stripe e WhatsApp como integrações server-to-server, autenticadas, idempotentes e observáveis.

## Requisitos

- configurar `APP_URL`, Price IDs e secrets somente em Edge Function secrets;
- deploy de `create-checkout`, `stripe-webhook` e `create-employee`;
- verificar assinatura Stripe e gravar eventos em `webhook_events`;
- endpoint WhatsApp aceita apenas segredo interno/worker; nenhuma chamada direta do browser;
- lembretes protegidos por segredo de cron, fila/retry e idempotência por agendamento;
- logs estruturados sem telefone, OTP, senha ou token.

## Critérios de aceite

1. Alterar plano no cliente não altera o Price ID cobrado.
2. Reentrega de webhook não duplica estado nem cobrança.
3. Uma chamada anônima a WhatsApp/reminders é recusada.
4. Falha de mensagem é rastreável e reprocessável sem duplicar envio.
5. Locks abandonados por crash são recuperados após o TTL e não ficam presos em `processing`.
6. Um webhook sem organização correspondente não é marcado como processado.

## Implementação sem credenciais — 15/08/2026

Concluídos no ambiente de teste:

- outbox `message_deliveries` com RLS, unicidade por agendamento/template, claim concorrente, retry com backoff e estados rastreáveis;
- recuperação de locks `processing` abandonados, com TTL configurável por `INTEGRATIONS_CLAIM_TTL_SECONDS` (60–3600 segundos);
- worker de lembretes restrito a `whatsapp` + `appointment_reminder`, que descarta agendamentos não confirmados sem chamar o provedor;
- confirmação de lembrete por RPC transacional: entrega `sent` e `appointments.reminder_sent_at` são persistidos juntas;
- ledger Stripe com claim atômico antes de atualizar assinatura, falha recuperável quando nenhuma organização é alterada e reconhecimento seguro de redelivery;
- boundary interno de WhatsApp com segredo compartilhado, contrato de templates limitado e logs sem dados pessoais;
- worker de lembretes com enfileiramento idempotente e retorno apenas de contadores agregados;
- tipos TypeScript regenerados e teste SQL transacional.

### Checklist manual de configuração

1. Criar os três Prices recorrentes no Stripe e inserir apenas seus IDs em `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_CLINIC`.
2. Inserir `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, `WHATSAPP_CLOUD_API_TOKEN`, `PHONE_NUMBER_ID`, `WHATSAPP_INTERNAL_SECRET` e `REMINDERS_CRON_SECRET` como Edge Function secrets — nunca no frontend ou Git.
3. Registrar no Stripe o endpoint `stripe-webhook` e enviar eventos de checkout, assinatura e falha de fatura.
4. Aprovar no Meta os templates `appointment_reminder`, `appointment_confirmation` e `portal_otp`, com parâmetros na ordem usada pelas funções.
5. Criar cron autenticado que chame `send-reminders` com `x-cron-secret`; começar em sandbox e monitorar os logs estruturados.
6. Executar os cenários sandbox de assinatura, redelivery Stripe, falha/retry WhatsApp e lembrete de agendamento antes de produção.

### Limite conhecido

Sem credenciais Stripe/Meta não é possível validar uma assinatura criptográfica real, criar checkout ou confirmar a aceitação de um template pelo provedor. As funções retornam erro controlado de configuração até os secrets serem definidos.
