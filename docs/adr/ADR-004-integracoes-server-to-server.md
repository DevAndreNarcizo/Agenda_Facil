# ADR-004 — Stripe e WhatsApp são integrações exclusivamente server-to-server

**Status:** aceito
**Data:** 2026-08-15

## Contexto
Checkout aceitava Price ID do navegador e WhatsApp podia receber chamadas anônimas.

## Decisão
Preço Stripe é resolvido por código de plano e secret do servidor. Webhook usa assinatura e ledger idempotente. WhatsApp/reminders aceitam apenas chamadas internas autenticadas por secret/cron.

## Consequências
- variáveis obrigatórias são configuradas no Supabase, não no frontend;
- deploy deve ser coordenado com migration e testes de sandbox;
- não expor detalhes do provedor ou OTP em respostas de erro.
