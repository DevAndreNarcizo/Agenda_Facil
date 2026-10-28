# SPEC-006 — Ativação segura de integrações externas

> Atualização25/10/2026: os estados remotos históricos abaixo não equivalem à homologação da migração. A implementação Angular/Laravel está na [SPEC-017](SPEC-017-migracao-saas.md), com diferenças verificadas no [AUDIT](../migration/AUDIT.md) e progresso em [STATUS](../implementation/STATUS.md). Preserve os invariantes desta SPEC e consulte os gates atuais antes de desativar o legado.


**Status:** proposta
**Prioridade:** P0
**Dependências:** SPEC-002 e SPEC-005

## Objetivo
Colocar em operação controlada o OTP, os lembretes WhatsApp, o Stripe de assinatura e o cron já implementados no ambiente de teste.

## Escopo
- cadastrar secrets exclusivamente no Supabase Edge Functions;
- configurar Prices, webhook e sandbox Stripe;
- configurar Meta/WhatsApp Cloud API e templates aprovados;
- registrar cron autenticado para `send-reminders`;
- criar checklist de health check, logs e rollback por integração.

## Fora do escopo
Cobrança de serviços ao cliente final, campanhas de marketing e alteração de planos pelo cliente.

## Requisitos funcionais
1. Cada integração deve expor estado operacional: não configurada, sandbox, ativa ou degradada.
2. OTP, lembretes e webhook devem falhar de modo controlado, sem vazar secrets ou dados pessoais.
3. O cron deve usar segredo próprio, registrar somente contadores e poder ser desabilitado sem deploy.
4. Webhooks Stripe devem ser validados em sandbox antes de produção.

## Critérios de aceite
- [ ] Fluxo real de OTP entrega e valida um código sem expô-lo ao browser ou logs.
- [ ] Um lembrete sandbox é enviado uma única vez e fica rastreável na outbox.
- [ ] Checkout e redelivery Stripe atualizam a assinatura esperada.
- [ ] Health check e procedimento de rollback estão documentados.

## Rollout
Sandbox por integração → teste manual documentado → ativação gradual por organização piloto → monitoramento de erros e custos.
