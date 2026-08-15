# ADR-001 — `organizations` é o contrato multitenant canônico

**Status:** aceito
**Data:** 2026-08-15

## Contexto
O código continha `companies/company_id` e `organizations/organization_id` em paralelo, causando falhas em RLS, webhook e portal.

## Decisão
Todo código novo, migration e integração usará `public.organizations` e `organization_id`. SQL legado não será aplicado. A transição do banco ocorrerá por migration revisada em staging.

## Consequências
- simplifica filtros, tipos e metadata Stripe;
- exige inventário e migração explícita para qualquer instalação ainda em `companies`;
- tipos Supabase passam a ser gerados a partir desse schema.
