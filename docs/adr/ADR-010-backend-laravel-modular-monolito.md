# ADR-010 — Backend Laravel como monólito modular

**Status:** aceito
**Data:** 2026-11-05

## Contexto
O sistema atual não tem backend próprio: a lógica vive em Edge Functions Deno + RPCs no Supabase (ver `docs/migration/AUDIT.md`). A missão exige um backend Laravel 13 (PHP 8.4+), API REST versionada, Sanctum e PostgreSQL como fonte autoritativa, sem microserviços nem Kubernetes sem necessidade.

## Decisão
Adotar um **monólito modular** em `backend/app/Modules/<Dominio>` (namespace PSR-4 `Modules\`), com domínios explícitos: Identity, Organizations, Memberships, Professionals, Customers, Services, Scheduling, PublicBooking, CustomerPortal, Billing, Notifications, Analytics, Audit. Controllers finos; regra em services/actions; policies por recurso; transações e eventos quando necessários. API versionada em `/api/v1` com contrato OpenAPI (`docs/api/openapi.yaml`). Autenticação SPA via Sanctum (cookie HttpOnly + CSRF / token).

## Consequências
- Um único deploy, com fronteiras de domínio claras — evolui para extração futura se necessário, sem complexidade operacional de microserviços agora.
- O servidor é a autoridade sobre tenant, permissões, cotas, preço e assinatura (nada confiado ao navegador).
- Chaves UUID nas tabelas de domínio preservam os IDs do Supabase na migração de dados.
- PostgreSQL 18 é a fonte autoritativa; o loop de testes pode usar SQLite em memória, mantendo migrações compatíveis (índice parcial específico de PostgreSQL isolado por driver).
