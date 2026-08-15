# SPEC-001 — Segurança multitenant e RLS

**Status:** em implementação — validada no ambiente remoto de teste
**Prioridade:** P0

## Objetivo

Estabelecer `organizations/organization_id` como contrato único e impedir leitura, escrita ou escalação de privilégios entre organizações.

## Escopo

- aplicar a migration `20260815_000001_canonical_organizations_security.sql` em staging;
- remover políticas e SQL legados que usam `companies/company_id` após inventário;
- gerar `src/lib/database.types.ts` pelo Supabase CLI conectado ao projeto;
- mover mutações administrativas de perfis para Edge Functions;
- adicionar testes de isolamento para owner, admin, employee e duas organizações.

## Execução atual — 15/08/2026

- Migration canônica aplicada ao projeto remoto de teste e complementada por `20260815_000002_optimize_rls_policies.sql`.
- Tipos oficiais do banco regenerados em `src/lib/database.types.ts`.
- Matriz transacional de RLS adicionada em `supabase/tests/rls-isolation.sql` e aprovada para owner, admin e employee de uma organização contra uma segunda organização.
- Security Advisor sem alertas; o Performance Advisor manteve apenas avisos informativos de índices ainda sem uso em um banco sem carga.

## Fora do escopo

Portal autenticado, regras de agenda e integração WhatsApp.

## Critérios de aceite

1. Um usuário da organização A não lista, cria, altera ou exclui registros da B.
2. Um usuário não muda `role` nem `organization_id` pela API pública.
3. Apenas owner inicia checkout; admin gerencia equipe pelo endpoint administrativo.
4. `webhook_events` aceita cada evento Stripe uma única vez.
5. `supabase gen types typescript` substitui o contrato manual e `npm run build` continua aprovado.

## Plano de rollout

Backup → staging → testes de matriz de papéis → janela de produção → monitoramento de RLS/erros → rollback restaurando policies exportadas.
