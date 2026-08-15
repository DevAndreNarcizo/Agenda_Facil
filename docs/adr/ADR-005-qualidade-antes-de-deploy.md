# ADR-005 — Qualidade automatizada é requisito de merge

**Status:** aceito
**Data:** 2026-08-15

## Contexto
O repositório não possuía testes, CI e chegava a falhar no build.

## Decisão
Todo PR em `main` executa `npm ci`, lint, Vitest, build e audit de dependências runtime. A cobertura cresce por risco: domínio, autorização, integrações e E2E dos fluxos de receita.

## Consequências
- falhas são detectadas antes do deploy;
- build não é evidência suficiente para produção;
- testes RLS e E2E passam a ser gate de lançamento do piloto.
