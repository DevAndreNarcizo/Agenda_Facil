# ADR-002 — RLS e Edge Functions são a fronteira de autorização

**Status:** aceito
**Data:** 2026-08-15

## Contexto
Guards React e filtros por ID melhoram UX, mas não impedem chamadas diretas à API.

## Decisão
RLS será aplicado a todas as tabelas públicas por `organization_id`. Operações administrativas e que exigem Service Role (equipe, onboarding, billing, portal) passam por Edge Functions que validam JWT, papel e payload.

## Consequências
- browser nunca recebe Service Role nem escolhe organização/preço livremente;
- cada função exige contrato, segredo e teste de autorização;
- policies exigem teste em duas organizações antes do deploy.
