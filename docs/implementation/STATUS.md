# STATUS de implementação — Migração Agenda Fácil

> Fonte única de verdade do progresso. Atualizado a cada fase. **Nada é marcado "pronto" sem evidência verificada.**

**Última atualização:** 2026-11-05 · **Branch:** `migracao/saas-angular-laravel`

## Visão geral

| Fase | Estado | Evidência |
|---|---|---|
| A — Auditoria + baseline | ✅ Concluída | `docs/migration/AUDIT.md`; baseline de testes §abaixo |
| B — Fundação Laravel + Sanctum | 🟡 Backend fundado e testado | `backend/`; 41 testes Pest verdes |
| B — Fundação Angular | 🟡 App standalone + auth/guards/interceptors + billing; build e testes verdes | `frontend-angular/`; ADR-012 |
| C — Banco + multi-tenancy | 🟡 Modelo + isolamento provados; migração de dados ⛔ bloqueada (dump do Supabase) | `TENANT_MATRIX.md`; MultiTenancyTest |
| D — Funcionalidades (backend) | 🟡 Serviços/Profissionais/Clientes/Agenda com anti-overlap e cotas, provados | Scheduling/Services/Customers/Professionals; 41 testes |
| E — Billing | 🟡 Lógica correta + cotas + webhooks provados (provedor fake); sandbox Stripe/Asaas ⛔ bloqueado | `SUBSCRIPTIONS.md`; billing tests |
| F — Segurança/E2E/QA | ⬜ Não iniciada | — |
| G — Staging/docs/piloto | ⬜ Não iniciada | docs operacionais criados |

## Entregue na Fase B/E (backend Laravel)

- Monólito modular Laravel 13 (PHP 8.4) em `backend/app/Modules/` — ADR-010.
- Autenticação Sanctum (SPA) + provisionamento transacional de organização (owner).
- Multi-tenancy: `organizations`/`memberships`/`organization_settings`, `ResolveTenantContext`, `TenantContext`.
- Billing completo e correto — ADR-011: catálogo no servidor, status canônico único, `active` só com pagamento confirmado, trial não reutilizável, sem duplicidade, enforcement de cotas, ledger de webhooks idempotente, `BillingProvider` desacoplado (fake/stripe/asaas).
- API REST `/api/v1` + OpenAPI (`docs/api/openapi.yaml`).
- Docker Compose (PostgreSQL 18 + MinIO + backend).

## Entregue na Fase D (backend — núcleo operacional)

- Domínios Services, Professionals, Customers, Scheduling (`backend/app/Modules/`).
- **Agenda sem sobreposição** (SchedulingService): lock consultivo por profissional + verificação de interseção + constraint `EXCLUDE` (PostgreSQL) — SPEC-004/ADR-006. Cancelados não bloqueiam horário.
- **Cotas aplicadas a dados reais**: criação de profissional respeita o limite do plano (402); criação de agendamento consome a cota mensal (402 ao estourar; renova por mês).
- API: CRUD de serviços (gestores), profissionais (com cota), clientes, e agenda (criar/remarcar/status), todas tenant-scoped e com guard de assinatura (`subscription.active`).
- Isolamento anti-IDOR/BOLA provado por teste HTTP (acesso cruzado entre 2 orgs negado; dado da outra org intacto).

## Evidência consolidada

- **41 testes Pest / 98 asserções — todos passando** (`php artisan test`); Pint limpo; migrações aplicam (SQLite no sandbox; PostgreSQL 18 alvo).

## Baseline verificado (Fase A) — executado em 2026-11-05 neste ambiente

| Checagem | Comando | Resultado |
|---|---|---|
| Instalação | `npm ci` | ✅ 486 pacotes (19 vulnerabilidades: 12 moderate, 7 high — pendente auditoria) |
| Lint | `npm run lint` | ✅ limpo |
| Typecheck | `npx tsc -b` | ✅ limpo |
| Unit (vitest) | `npm test` | ✅ 31 testes / 10 arquivos |
| SQL tests | `supabase/tests/*.sql` | ⚠️ não executável sem backend vivo |
| E2E (Playwright) | `npm run test:e2e` | ⚠️ exige secrets `E2E_*`/Supabase |

## Toolchain do ambiente (verificada)

PHP 8.4.27 + Composer 2.9.5 (via mise) · Node 22 · Docker 5.2.3 · Postgres via Docker · rede OPEN_INTERNET. (PHP/Composer não estão no PATH padrão — ativar com `mise`.)

## Pendências / riscos residuais

- Schema núcleo (`organizations/profiles/services/appointments`) e colunas de assinatura **não versionados** → bloqueiam modelagem fiel (Fase C).
- Migrations de depósito conflitantes; scripts `fix_*rls.sql` perigosos a arquivar.
- Billing com 10 defeitos confirmados (AUDIT §5).
- 19 vulnerabilidades de dependências a auditar (Fase F).

## Decisões arquiteturais

Registradas como ADRs em `docs/adr/` (novas ADRs a partir de ADR-010).

## Entregue na Fase B (frontend — fundação Angular)

- App Angular 22 standalone em `frontend-angular/` (ADR-012), isolado do app React (preservado).
- Zoneless + signals; TypeScript estrito; lazy loading por rota (chunks separados no build).
- `AuthService` (signals) + `BillingService` consumindo a API v1 do Laravel.
- Interceptors: `authInterceptor` (token Sanctum + `X-Organization-Id` + Accept) e `errorInterceptor` (401→logout).
- Guards: `authGuard`, `managerGuard`.
- Reactive Forms tipados: login e cadastro; páginas dashboard/planos/assinatura.
- **Build de produção OK** (chunks por rota) e **2 testes Angular verdes** (shell + interceptor), via runner Vitest (chromium do Playwright no sandbox).

> Pendente: migração completa das 12 áreas com paridade visual, design tokens completos do app React, E2E Playwright, guard de assinatura nas rotas pagas. O React só é desativado após paridade verificada.