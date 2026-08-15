# SPEC-001 — Segurança multitenant e RLS

**Status:** pronta para implementação em staging
**Prioridade:** P0

## Objetivo

Estabelecer `organizations/organization_id` como contrato único e impedir leitura, escrita ou escalação de privilégios entre organizações.

## Escopo

- aplicar a migration `20260815_000001_canonical_organizations_security.sql` em staging;
- remover políticas e SQL legados que usam `companies/company_id` após inventário;
- gerar `src/lib/database.types.ts` pelo Supabase CLI conectado ao projeto;
- mover mutações administrativas de perfis para Edge Functions;
- adicionar testes de isolamento para owner, admin, employee e duas organizações.

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
