# ADR-008 — Outbox e ledger para integrações externas

**Status:** aceito  
**Data:** 2026-08-15

## Contexto

Chamadas diretas do cron ao WhatsApp não eram rastreáveis, podiam repetir uma mensagem e não tinham recuperação uniforme. O webhook Stripe verificava uma duplicidade somente depois de alterar a organização, deixando uma janela concorrente.

## Decisão

- Lembretes de agendamento passam por `message_deliveries`, uma outbox protegida por RLS e unicidade por `(appointment_id, template_name)`.
- Workers reivindicam itens por função transacional com `FOR UPDATE SKIP LOCKED`; o worker de lembretes só recebe `whatsapp` + `appointment_reminder`.
- Claims em `processing` que ultrapassam o TTL configurável são devolvidos a `failed` e podem ser recuperados, impedindo locks abandonados por crash.
- Antes do envio, agendamentos que não estão `confirmed` são encerrados como `skipped`. Depois de aceito pelo provedor, uma RPC transacional confirma a entrega e atualiza `reminder_sent_at`.
- Falhas conhecidas recebem retry com backoff. Resultados ambíguos são `unknown` e não sofrem reenvio automático, evitando duplicidade.
- Webhooks Stripe usam `webhook_events` como ledger com claim atômico antes de mutar o estado comercial.
- Funções RPC públicas são wrappers `SECURITY DEFINER`, sem acesso para `anon`/`authenticated` e com execução apenas do `service_role`; a lógica fica no schema `private`.
- Não persistimos na outbox telefone, mensagem, OTP, token ou payload do provedor. Logs são estruturados e contêm somente IDs e códigos operacionais.

## Consequências

- O cron pode ser reexecutado sem duplicar uma entrega já confirmada; locks abandonados voltam a ser elegíveis após o TTL.
- A transação de confirmação evita contabilizar uma mensagem como enviada quando a atualização de `reminder_sent_at` falha.
- Um resultado de rede ambíguo requer decisão operacional explícita antes de reenviar; esta é a troca necessária para não prometer exatamente-uma-entrega a um provedor que não expõe chave de idempotência para envio de template.
- Preços Stripe, templates WhatsApp e credenciais permanecem secrets de Edge Functions e precisam de configuração posterior.
