# MIGRATION_PLAN — Agenda Fácil → SaaS (Angular 22 + Laravel 13)

> Plano reversível e incremental. Complementa `AUDIT.md`. Nada destrutivo sem backup; o React/Supabase atual permanece em produção até **paridade verificada** e cutover autorizado.

## Princípios

1. **React fica de pé até paridade.** Desativação só após checklist da Definition of Done (§11 da missão) e procedimento documentado (`docs/operations/`).
2. **Ambiente novo isolado.** Laravel/Angular/PostgreSQL via Docker Compose, sem tocar Supabase/Netlify/Stripe de produção.
3. **Cada fase = PR revisável** com código funcional, testes executados, evidências, pendências e riscos residuais.
4. **Dados sintéticos** em dev/teste. Dados reais só em cutover autorizado, com dump→import preservando IDs/relacionamentos.
5. **Servidor é autoridade** sobre tenant, permissões, criação de agendamento, cotas, preço e assinatura. O navegador não dita organização/plano/papel.

## Fases (estado)

- [x] **A — Auditoria + baseline** — `AUDIT.md` + baseline verde (lint/tsc/31 testes). **Concluída.**
- [ ] **B — Fundação Angular/Laravel + Sanctum + Docker Compose + CI**
- [~] **C — Banco + multi-tenancy** — multi-tenancy/policies/testes 2+ orgs ✅; **pipeline de migração de dados pronto e testado** (`docs/migration/DATA_MIGRATION.md`), execução real ⛔ bloqueada pelo dump do Supabase
- [ ] **D — Migração de funcionalidades (paridade por área, React segue vivo)**
- [ ] **E — Billing (`BillingProvider`, catálogo no servidor, lifecycle correto, cotas, webhooks, reconciliação, sandbox)**
- [ ] **F — Segurança + E2E + QA visual**
- [ ] **G — Staging + docs operacionais + checklist de piloto**

## Reversibilidade / rollback por fase

| Fase | Como reverter |
|---|---|
| B–D | Reverter PR; `docker compose down`; produção React/Supabase intacta |
| C (dados) | Import é para banco novo; Supabase original preservado até cutover |
| E (billing) | `BillingProvider` adaptador; nenhum registro Stripe apagado; reconciliação antes de cutover |
| G (cutover) | Procedimento e rollback em `docs/operations/ROLLBACK.md` |

## Bloqueios externos (ver AUDIT §Bloqueios)

Dump do Supabase vivo · Sandbox Stripe/Asaas · Credenciais WhatsApp de teste · Decisão de planos/preços.

> **Status de implementação acompanhado em** `docs/implementation/STATUS.md`.
