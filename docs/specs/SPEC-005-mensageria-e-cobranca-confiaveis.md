# SPEC-005 — Mensageria e cobrança confiáveis

**Status:** pronta para configuração após SPEC-001
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
