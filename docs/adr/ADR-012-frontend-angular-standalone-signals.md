# ADR-012 — Frontend Angular 22 standalone com signals

**Status:** aceito
**Data:** 2026-11-05

## Contexto
A missão exige migrar a SPA de React 19 para Angular 22 estável, com arquitetura standalone, TypeScript estrito, signals, Reactive Forms, interceptors e guards. O app React atual (ver `docs/migration/AUDIT.md`) permanece em produção até paridade verificada.

## Decisão
Criar uma aplicação Angular 22 isolada em `frontend-angular/` (sem tocar no app React na raiz), com:
- **Standalone components** + **lazy loading** por rota (`loadComponent`), espelhando o `React.lazy` atual.
- **Zoneless change detection** (padrão do Angular 22) + **signals** para estado (equivalente ao AuthContext/React Query).
- **TypeScript estrito** (`strict: true`) e `HttpClient` com `fetch`.
- **Interceptors funcionais**: `authInterceptor` (token Sanctum + `X-Organization-Id`) e `errorInterceptor` (401→logout, normalização de erros).
- **Guards funcionais**: `authGuard` (sessão) e `managerGuard` (owner/admin); guard de assinatura previsto para rotas pagas.
- **Reactive Forms tipados** (`nonNullable`) com validação.
- Serviços tipados (`AuthService`, `BillingService`) consumindo a API v1 do Laravel.

## Consequências
- Build de produção gera chunks por rota (login/register/dashboard/plans/subscription) — carregamento sob demanda.
- O contexto de organização vai no header, mas a autoridade é do servidor (o backend valida o membership).
- O catálogo de planos é consumido do servidor (sem preços no frontend), coerente com ADR-011.
- Testes rodam no runner Vitest do Angular 22 (requer provider de browser; neste sandbox usa-se o chromium do Playwright). Paridade visual completa e migração das 12 áreas são trabalho das próximas iterações; o React só é desativado após paridade e procedimento seguro (ver `docs/operations/`).
