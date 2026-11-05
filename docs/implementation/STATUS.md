# STATUS de implementação — Migração Agenda Fácil

> Fonte única de verdade do progresso. Atualizado a cada fase. **Nada é marcado "pronto" sem evidência verificada.**

**Última atualização:** 2026-11-05 · **Branch:** `migracao/saas-angular-laravel`

## Visão geral

| Fase | Estado | Evidência |
|---|---|---|
| A — Auditoria + baseline | ✅ Concluída | `docs/migration/AUDIT.md`; baseline de testes §abaixo |
| B — Fundação Laravel + Sanctum | 🟡 Backend fundado e testado | `backend/`; 41 testes Pest verdes |
| B/D — Angular (fundação + onboarding + agenda) | 🟡 Auth/guards/interceptors + onboarding + agenda operacional consumindo a API; build e 5 testes verdes | `frontend-angular/`; ADR-012 |
| C — Banco + multi-tenancy | 🟡 Modelo + isolamento provados; migração de dados ⛔ bloqueada (dump do Supabase) | `TENANT_MATRIX.md`; MultiTenancyTest |
| D — Funcionalidades (backend) | 🟡 Serviços/Profissionais/Clientes/Agenda + Reserva pública/Portal, provados | Scheduling/Services/Customers/Professionals/PublicBooking/CustomerPortal; 48 testes |
| E — Billing | 🟡 Lógica correta + cotas + webhooks provados (provedor fake); sandbox Stripe/Asaas ⛔ bloqueado | `SUBSCRIPTIONS.md`; billing tests |
| F — Segurança/E2E/QA | 🟡 CI (backend PostgreSQL + Angular), rate-limit/anti-enumeração/isolamento provados | `.github/workflows/backend.yml`, `frontend-angular.yml` |
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

## Entregue na continuação (PublicBooking + CustomerPortal + CI)

- **Reserva pública por link** (`/public/{slug}/context`, `/portal/booking`): contexto por slug com allowlist de serviços/profissionais; criação reutiliza o SchedulingService (anti-overlap + cota); 404 para slug inexistente/desabilitado (não vaza dados de outra org).
- **Portal do cliente (OTP + sessão opaca)** — SPEC-002: anti-enumeração (resposta genérica), rate-limit por telefone e IP, código com hash+pepper (5 min, ≤5 tentativas), sessão opaca de 8h (só o hash do token é guardado). Isolamento comprovado: token de uma org não vale em outra.
- **CI**: `backend.yml` roda Pint + migrações + Pest contra **PostgreSQL 18** (valida índice parcial e constraint EXCLUDE de anti-overlap); `frontend-angular.yml` roda build + testes.
- **48 testes Pest / 117 asserções — todos passando**.

## Entregue na continuação (Angular: onboarding + agenda)

- **Backend**: endpoint de onboarding transacional (`POST /organization/onboarding`, owner-only, idempotente: identidade + 7 horários + 1º serviço + marca conclusão) e `GET /organization` (estado + horários). `OnboardingService`, `OrganizationController`, `BusinessHour`. Testes de onboarding (conclusão + bloqueio de não-owner).
- **Angular**: página de **onboarding** (Reactive Form com agenda semanal) e **agenda operacional** (listar o dia, criar agendamento, mudar status) consumindo a API; `OrganizationService`/`AgendaService` (signals); `onboardingCompletedGuard` (redireciona ao onboarding quando pendente); erros 409 (conflito) e 402 (cota) traduzidos na UI.
- Qualidade: backend **50 testes / 127 asserções**; Angular **5 testes** + build de produção (chunks `onboarding-page`, `agenda-page`).

> Paridade da área operacional central (onboarding→agenda) agora existe no Angular consumindo o backend — passo concreto rumo ao cutover do React.

## Entregue na continuação (Angular: CRUD + assinatura)

- **Clientes**: página de busca + cadastro (`CustomersService`).
- **Serviços**: listagem + cadastro (gestor); UI reflete 403 do servidor.
- **Profissionais**: listagem + cadastro com tradução do **402 (cota do plano)** e 403.
- **Assinatura**: plano atual + **uso de cotas** (profissionais/agendamentos no mês, com barra), troca de plano e cancelamento ao fim do período, consumindo a API.
- Rotas protegidas por `authGuard` + `onboardingCompletedGuard`; links no painel.
- Qualidade: Angular **7 testes** (app, interceptor, AgendaService, CustomersService) + build de produção (chunks por página). Backend inalterado (50 testes verdes).

> Paridade das áreas operacionais do MVP (agenda, clientes, serviços, profissionais, assinatura) agora existe no Angular consumindo o backend.

## Entregue na continuação (Angular: reserva pública + portal)

- **Página pública `/reservar/:slug`** (fora da área autenticada): escolher serviço/profissional/horário → OTP por WhatsApp → sessão opaca → reserva confirmada; estados loading/choose/otp/done/unavailable.
- `PublicBookingService`: contexto por slug, request/verify de OTP, criação de reserva com header `X-Portal-Session`; token do portal guardado por slug.
- **Isolamento de credenciais**: o `authInterceptor` NÃO anexa o token Sanctum nem `X-Organization-Id` a endpoints `/public/...`; o `errorInterceptor` não derruba a sessão do painel em 401 público. Comprovado por teste.
- Tradução de erros: 409 (horário ocupado → volta à escolha), 401 (sessão expirada → refaz OTP), 422 (código inválido).
- Qualidade: Angular **10 testes** (+3 de public-booking) + build (chunk `public-booking-page`). Backend inalterado.

> Fluxo "cliente externo reserva" agora ponta a ponta também na stack Angular (backend já testado).

## Entregue na continuação (backend: Notifications / lembretes)

- Módulo **Notifications** (`backend/app/Modules/Notifications`): outbox `message_deliveries` (migration), `ReminderService`, canal desacoplado `NotificationChannel` (fake/whatsapp), command `reminders:dispatch` e agendamento no Scheduler (a cada 5 min).
- Preserva o modelo do sistema atual (SPEC-005): idempotência por `(appointment_id, template_name)`, claim com **lease por `lock_token`** (recupera leases expirados), **backoff exponencial** (30s·2^(n-1), teto 1h), e conclusão **só se o agendamento ainda está `confirmed`** (marca `reminder_sent_at`, não reenvia).
- WhatsApp real fica como canal plugável (bloqueio externo: credenciais) — a lógica roda e é testada com canal fake.
- Qualidade: backend **56 testes / 148 asserções** verdes; Pint limpo. Command e schedule verificados via `artisan`.

> Último recurso comercial do MVP (lembretes automáticos) implementado e testado, sem depender de bloqueios externos para a lógica.