# AUDIT — Agenda Fácil (Fase A)

> **Escopo:** auditoria inicial do estado real do repositório `DevAndreNarcizo/Agenda_Facil` como base para a migração a um SaaS multi-tenant (Angular + Laravel) com cobrança recorrente.
> **Método:** leitura direta de código, migrations, Edge Functions e testes; execução do baseline de testes do frontend; verificação da toolchain do ambiente. Documentação antiga **não** prevaleceu sobre o código verificado.
> **Data da auditoria:** 2026-11-05 · **Branch:** `migracao/saas-angular-laravel` (criada a partir de `main` em `1f99af4`).
> **Natureza:** somente leitura/diagnóstico. Nenhum ambiente remoto, credencial ou dado real foi tocado.

---

## 0. Resumo executivo (o que é real × o que é narrativa)

O Agenda Fácil **hoje** é uma SPA **React 19 + Vite + TypeScript** servida de forma estática (Netlify), tendo **Supabase** (PostgreSQL + Auth + Edge Functions Deno + Realtime) como backend. **Não existe nenhum código Angular nem Laravel no repositório.** A missão (Angular 22 + Laravel 13 + PostgreSQL próprio + Sanctum) é, portanto, uma **reconstrução de stack**, não um ajuste incremental — é importante registrar isso com honestidade antes de qualquer promessa de prazo.

Estado por eixo:

| Eixo | Estado real | Evidência |
|---|---|---|
| Frontend | React 19 + Vite, maduro, com design system próprio ("painel refinado"), 12 áreas funcionais implementadas | `src/App.tsx`, `src/components/panel/`, `package.json` |
| Backend | Supabase (sem servidor próprio); lógica crítica em Edge Functions Deno + RPCs PL/pgSQL `SECURITY DEFINER` | `supabase/functions/`, `supabase/migrations/` |
| Multi-tenancy | Implementado via RLS + `private.current_organization_id()`; papéis owner/admin/employee | `supabase/migrations/20260815_000001_*.sql` |
| Autenticação | Supabase Auth (donos) + portal do cliente por OTP WhatsApp (sessão opaca) | `src/context/AuthContext.tsx`, `supabase/functions/*portal*` |
| Billing | Stripe Checkout + webhook; **planos/preços no frontend**; estado da assinatura em colunas de `organizations` | `supabase/functions/create-checkout`, `stripe-webhook`, `src/hooks/use-organization.ts` |
| Testes | 31 testes unitários de frontend (vitest) **passando**; testes SQL e E2E exigem backend vivo | execução local (§8) |
| Toolchain do SaaS alvo | PHP 8.4 + Composer, Node 22, Docker, PostgreSQL via Docker — **disponíveis** | `get_sandbox_info` |

**Conclusão honesta de prazo:** reconstruir frontend (Angular) **e** backend (Laravel) **e** migrar billing com paridade verificada até 15/12/2026 é agressivo. O caminho responsável é **priorizar o backend Laravel + billing correto + multi-tenancy** (onde estão os riscos de segurança e receita) e tratar o Angular como migração incremental por área, mantendo o React em produção até haver paridade comprovada (instrução 4 da missão). O detalhamento está em `MIGRATION_PLAN.md`.

---

## 1. Inventário de funcionalidades (implementadas / parciais / simuladas)

Classificação conservadora. "Implementada" = há código + caminho de dados coerente; **não** significa homologada em produção.

### Implementadas (código coerente, com testes onde indicado)
- **Autenticação de donos** — login e-mail/senha, recuperação de senha, login por OTP WhatsApp, Google OAuth condicional. `src/pages/auth/*`, `AuthContext.tsx`.
- **Cadastro + onboarding transacional** — signup cria perfil via trigger `handle_new_user`; onboarding em RPC `complete_onboarding` (cria org, settings, horários, 1º serviço). `supabase/migrations/20261005000001_signup_hardening.sql`.
- **Agenda operacional** — criação/remarcação/status/cancelamento/bloqueios, **todas** via Edge Function `manage-appointment` → RPC `manage_appointment_command` com advisory lock + exclusão gist anti-overlap. `supabase/functions/manage-appointment`, migrations 000006/000007.
- **Clientes, Serviços, Profissionais/colaboradores** — CRUD via PostgREST + RLS; criação de colaborador via Edge Function `create-employee` (service role). `src/hooks/use-customers.ts`, `use-services.ts`, `use-employees.ts`.
- **Reserva pública por link** (`/reservar/:slug`) e **Portal do cliente** (OTP → sessão opaca). `supabase/functions/public-booking`, `portal-*`, `request/verify-portal-otp`.
- **Analytics** — RPCs de agregação versionadas (faturamento, picos, fontes de reserva). migrations 000004→20261004234712.
- **Lembretes WhatsApp** — outbox transacional (`message_deliveries`) com leases por token e idempotência; worker `send-reminders` (cron). migrations 000009–000012.
- **Configurações / identidade visual** — tema por organização (cor de marca → CSS vars), QR code de reserva. `use-organization-theme.ts`, `components/dashboard/settings/`.

### Parciais / com dívidas conhecidas
- **Assinaturas (billing)** — fluxo Stripe existe mas com defeitos estruturais (§5). Catálogo de planos/preços vive **no frontend** (`src/hooks/use-organization.ts` `PLANS`), não no servidor. Não há enforcement real de limites de plano.
- **No-show / sinal (depósito)** — "foundation" presente, porém **duas migrations conflitantes** definem as mesmas tabelas com formatos diferentes (§3). Não replayável de banco vazio.
- **Lista de espera / encaixes** — apenas SPEC (009); sem código.

### Simuladas / fora do repositório
- **Colunas de assinatura** em `organizations` (`plan_name`, `subscription_status`, `stripe_*`, `trial_end`) são **lidas/escritas** pelo código, mas **não existem em nenhuma migration do repositório** — a única definição committada (migration legada `20260321`) mira `public.companies` com `IF EXISTS` (no-op). Existem apenas no banco vivo. **Risco de reprodutibilidade.**
- **Tabelas canônicas núcleo** (`organizations`, `profiles` na forma org, `services`, `appointments`) não têm `CREATE TABLE` no repositório — as migrations assumem que já existem. Só o schema **legado** `schema.sql` (modelo `companies`/`company_id`) está committado, e ele é **incompatível** com o modelo canônico.

---

## 2. Estado do frontend React/Vite

- **Stack:** React 19.2, Vite 6, TypeScript 5.9 (strict), react-router-dom 7, TanStack Query 5, react-hook-form + zod, Tailwind 3 + Radix, Material Symbols (fonte local), fontes Inter/Jakarta locais (sem rede). `package.json`.
- **Roteamento:** árvore única em `src/App.tsx`, **todas as rotas lazy** (`React.lazy` + `Suspense`); chunks de vendor manuais no `vite.config.ts`.
- **Guard:** `src/components/ProtectedRoute.tsx` — autorização **apenas no cliente** (o próprio arquivo registra que a segurança real está em RLS + Edge Functions). Checa `session` → `organization_id` → `role`.
- **Estado:** `AuthContext` (sessão/perfil, com retry do perfil por causa do trigger assíncrono) + React Query (chaves por `organization_id`, invalidação disciplinada). Realtime por canal Supabase em `use-appointments.ts`.
- **Acesso a dados (dois caminhos):** (a) leituras/escritas diretas via PostgREST confiando no RLS; (b) **escritas sensíveis sempre via Edge Function** (agenda, portal, reserva pública). Idioma de segurança: `.select('id')` pós-UPDATE + `assertRowsAffected()` para detectar RLS negando silenciosamente (`use-organization.ts`).
- **Design system:** três famílias de tokens em CSS vars (shadcn, `af-*`, `stitch-*`); dark mode por classe no `<html>`. Base sólida de **design tokens reaproveitáveis** para o Angular.
- **PWA:** service worker artesanal (`public/sw.js`) que **ignora** chamadas a Supabase/Stripe (precisam ficar online).
- **Qualidade:** `tsc -b` limpo, `eslint` limpo, 31 testes vitest passando (§8).

---

## 3. Estado do banco Supabase e das migrations

- **19 migrations** em `supabase/migrations/` + 2 scripts manuais perigosos (`fix_all_rls.sql`, `fix_rls_recursion.sql`) + schema legado (`schema.sql`, `schema_update.sql`) + `src/database/*.sql` (modelo antigo `company_id`).
- **Modelo canônico** (migrations `20260815_*` em diante): tenant = `organizations`; isolamento por `organization_id`; helper `private.current_organization_id()` (`SECURITY DEFINER`, schema `private` bloqueado) para evitar recursão de RLS em `profiles`.
- **Núcleo não definido no repo:** `organizations/profiles/services/appointments` são **assumidas existentes**. **Ação obrigatória na Fase C:** fazer *dump* do schema vivo (com autorização) para obter as colunas autoritativas antes de modelar no Laravel.
- **Migrations legadas / conflitos (riscos):**
  - `20260321_add_subscription_fields.sql` → `ALTER TABLE IF EXISTS public.companies` = **no-op**; colunas de assinatura e `subscription_status DEFAULT 'active'` nunca foram aplicadas por aqui.
  - **Depósito definido 2×** com schemas divergentes: `20260815_000014_deposit_foundation.sql` (`deposit_type/is_active/payment_window_minutes`) vs `20260816010800_spec_008_deposit_data.sql` (`deposit_mode/is_enabled/expiration_minutes`), ambos `CREATE TABLE` (não `IF NOT EXISTS`) → **não replayável de banco vazio**.
  - `fix_all_rls.sql`/`fix_rls_recursion.sql` recriam políticas **mais fracas** (helper `public.get_user_organization_id`, leitura de qualquer org quando o usuário não tem org). **Não** devem entrar na migração; são históricos a descartar.
- **Confiabilidade boa onde existe:** outbox com backoff exponencial + `UNIQUE(appointment_id, template_name)` + `FOR UPDATE SKIP LOCKED`; leases de lembrete por `lock_token` impedindo envio duplo (migration 000012); ledger de webhook idempotente (`webhook_events` + `claim/mark_webhook_event`).

---

## 4. Autenticação, RLS, permissões e portal do cliente

- **Auth de donos:** Supabase Auth. Trigger `handle_new_user` cria `profiles`; **endurecido** (migration `20261005000001`) para **nunca** ler `organization_id`/`role` de `raw_user_meta_data` (vetor de escalada de privilégio corrigido). Autocadastro sempre `role='owner'`; vínculo a org existente só via `create-employee` (service role).
- **RLS:** habilitado nas tabelas-tenant; políticas por `organization_id = private.current_organization_id()`, com wrapper `(SELECT ...)` (initplan) para performance. Papéis owner/admin/employee (+ `staff` aceito em alguns caminhos). Escritas de agenda **revogadas** de `authenticated` (só via RPC service-role). Proíbe autopromoção a `owner` e mudança do próprio papel.
- **Portal do cliente (passwordless):** `request-portal-otp` (rate-limit por telefone/IP, anti-enumeração, OTP com hash+pepper, 5 min, ≤5 tentativas) → `verify-portal-otp` (sessão **opaca** de 8h, só o hash do token é guardado, header `x-portal-session`). Camada de identidade **separada** do Supabase Auth.
- **Ponto de atenção p/ Laravel:** hashes de senha do Supabase (bcrypt do GoTrue) **não** devem ser presumidos compatíveis com o `Hash` do Laravel; planejar **redefinição segura de senha** na migração (§Riscos).

---

## 5. Checkout, Stripe, webhooks, trials e cobranças (estado + defeitos confirmados)

Fluxo: `create-checkout` (owner-only) cria Stripe Checkout `mode:'subscription'`; `stripe-webhook` valida assinatura, idempotência via `claim_webhook_event`, e atualiza colunas de `organizations`.

**Defeitos confirmados no código** (todos citados pela missão — verificados):

| # | Defeito | Evidência |
|---|---|---|
| 1 | **Migration legada mira `companies`** em vez de `organizations` (no-op) | `supabase/migrations/20260321_add_subscription_fields.sql:1` |
| 2 | **Marcação prematura de `active`** em `checkout.session.completed`, apesar de `trial_period_days:14` (deveria ser `trialing`, ainda mais com Pix assíncrono) | `stripe-webhook/index.ts` (update `subscription_status:'active'`) |
| 3 | **Trial reiniciado a cada checkout** — `trial_period_days:14` fixo, sem verificar trial anterior | `create-checkout/index.ts` (`subscription_data.trial_period_days`) |
| 4 | **Inconsistência `cancelled` × `canceled`** — webhook grava `'cancelled'` (deleted) e `subscription.status` cru (`'canceled'`); UI mapeia `canceled` | `stripe-webhook/index.ts` vs `SubscriptionPage.tsx:16` |
| 5 | **Risco de assinatura duplicada** — nada cancela a assinatura anterior antes de novo checkout; `checkout.session.completed` sobrescreve `stripe_subscription_id`, órfã a antiga | `create-checkout` + `stripe-webhook` |
| 6 | **Planos/preços no frontend** — catálogo `PLANS` (starter/pro/clinic, R$39/69/99) hardcoded no cliente | `src/hooks/use-organization.ts` |
| 7 | **Sem enforcement de limites de plano** no servidor (profissionais, agendamentos/mês, premium, mensagens) | ausência em RPCs/migrations |
| 8 | **Renovação/cobrança incompletas** — sem tabelas de `invoices`/`payments`; estado só em colunas de `organizations` | schema |
| 9 | **Pix em assinatura recorrente** — `payment_method_types:['card','pix']` em `mode:'subscription'`; Pix não é renovação automática | `create-checkout/index.ts` |
| 10 | **Sem fluxo completo de troca/cancelamento** (upgrade/downgrade/cancelar no fim do período) | UI só dispara novo checkout |

**Antes de migrar billing:** inventariar registros Stripe reais e **não** excluir assinatura/cliente/cobrança/histórico sem plano de reconciliação (§TENANT/SUBSCRIPTIONS docs). Validar meios de pagamento viáveis para a empresa brasileira (cartão recorrente; Pix tratado como avulso).

---

## 6. Fluxos críticos e dependências externas

- **Fluxos críticos:** signup→onboarding→agenda; reserva pública (slug→slot→portal session→create); portal OTP; billing (checkout→webhook→estado); lembretes (cron→outbox→WhatsApp).
- **Dependências externas:** Supabase (Auth/DB/Functions/Realtime), Stripe (billing), WhatsApp Cloud API / Twilio (OTP e lembretes), Netlify (hosting), Google OAuth (opcional).
- **Segredos esperados (env):** `VITE_SUPABASE_URL/ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `APP_URL`, `PORTAL_TOKEN_PEPPER`, `*_CRON_SECRET`, `*_INTERNAL_SECRET`, credenciais WhatsApp. (`.env.example`, `supabase/functions/.env.example`).

---

## 7. Problemas de segurança e riscos de perda de dados

**Segurança (pontos fortes):** RLS canônico; escrita de agenda só via RPC; portal com sessão opaca + anti-enumeração + rate-limit; webhook com verificação de assinatura + idempotência; signup endurecido contra escalada.

**Riscos de segurança a tratar na migração:**
- `fix_all_rls.sql`/`fix_rls_recursion.sql` committados podem ser executados por engano e **enfraquecer** o RLS. → **Remover/arquivar** no plano.
- Autorização no cliente (`ProtectedRoute`) não é defesa — no Laravel, **policies server-side por recurso** são obrigatórias (IDOR/BOLA).
- Pix + marcação `active` prematura pode liberar acesso pago **antes** de liquidar (§5).

**Riscos de perda de dados:**
- **Schema núcleo não versionado** → sem *dump* do banco vivo, a modelagem Laravel pode divergir das colunas reais. **Bloqueador** até dump autorizado.
- **Migrations de depósito conflitantes** → estado do banco vivo depende de qual aplicou; irreprodutível.
- **Hashes de senha** do Supabase podem não migrar → exigir fluxo de redefinição (não descartar contas).
- **Registros Stripe** não podem ser apagados sem reconciliação.

---

## 8. Testes existentes e resultados comprovados

**Executado neste ambiente (baseline Fase A):**
- `npm ci` → 486 pacotes (19 vulnerabilidades reportadas: 12 moderate, 7 high — auditar na Fase F).
- `npm run lint` (eslint) → **limpo**.
- `npx tsc -b` (typecheck strict) → **limpo**.
- `npm test` (vitest) → **31 testes, 10 arquivos, todos passando** (~2s). Cobrem: filtros de agendamento, modelo de agenda, auth-form/storage, brand-color, material-icons, métricas de fonte de reserva, portal-return-url, dashboard-stats.

**Não executável aqui (requer backend vivo):**
- `supabase/tests/*.sql` (9 arquivos: rls-isolation, portal-security, agenda-operational, deposit × 2, public-booking, panel-permissions, signup-hardening, integrations) — scripts psql `BEGIN…ROLLBACK` que precisam de um Postgres/Supabase com roles. **São testes negativos de multi-tenancy valiosos** a portar para PHPUnit/Pest + pgTAP.
- `e2e/agenda.spec.ts` (Playwright) e `scripts/run-agenda-concurrency-e2e.mjs` — exigem `E2E_*`/Supabase (ver `.github/workflows/quality.yml`).

**CI atual (`quality.yml`):** `npm ci` → lint → test → build → `npm audit --omit=dev --audit-level=high`; job E2E condicionado a secrets.

---

## 9. Mapa de equivalência React → Angular

| React (atual) | Angular 22 (alvo) |
|---|---|
| `react-router-dom` + `React.lazy` por rota | Angular Router com `loadComponent`/`loadChildren` (standalone) |
| `ProtectedRoute` (session/org/role) | `CanActivate`/`CanMatch` guards (auth, onboarding, permissão, **assinatura**) |
| `AuthContext` + Supabase auth listener | `AuthService` injetável (signals/RxJS) consumindo Sanctum |
| TanStack Query (chaves por org, invalidação) | TanStack Query Angular **ou** services + signals (mesma disciplina de cache) |
| Edge Function `invoke(...)` | `HttpClient` + **interceptors** (auth, erro, contexto) contra API REST Laravel |
| react-hook-form + zod | Reactive Forms tipados (+ validadores derivados dos schemas) |
| Tailwind + CSS vars (shadcn/`af-*`/`stitch-*`) + Material Symbols | **Reutilizar** tokens/fonte; recriar primitives (`Icon`, `PanelButton`, etc.) como componentes Angular |
| `sw.js` artesanal | Angular SW (ngsw) ou manter `sw.js` |
| Sessão opaca do portal (localStorage + header) | Idêntico (agnóstico de framework) |

As 12 áreas (landing/auth, cadastro/onboarding, dashboard, calendário, clientes, serviços, profissionais, reserva pública, portal, analytics, configurações/identidade, planos/assinaturas) mapeiam 1:1 para módulos/rotas standalone.

---

## 10. Mapa de equivalência Supabase Auth/Functions → Laravel

| Supabase (atual) | Laravel 13 (alvo) |
|---|---|
| Supabase Auth (GoTrue) | Sanctum (SPA) + fluxo de redefinição de senha na migração |
| Trigger `handle_new_user` | Action/Service de provisionamento transacional (Identity + Organizations) |
| RPC `complete_onboarding` | Action `CompleteOnboarding` (transação, idempotente) — módulo Organizations |
| Edge `manage-appointment` + RPC `manage_appointment_command` | Scheduling: controller fino → Action com lock/transação + regra anti-overlap (constraint `tstzrange` exclusion) |
| Edge `create-employee` | Memberships: convite/criação com policy (owner/admin) |
| `public-booking` / `portal-*` / OTP | PublicBooking + CustomerPortal (OTP rate-limited, sessão opaca/token) |
| `create-checkout` / `stripe-webhook` | Billing: `BillingProvider` (interface) + Stripe/Asaas adapters; webhooks assinados + idempotência |
| Outbox + `send-reminders` (cron) | Notifications: Laravel Queue + Scheduler + tabela outbox (reaproveitar modelo de leases) |
| RPCs de analytics | Analytics: queries/materializações no serviço |
| RLS (`current_organization_id`) | **Autorização server-side** (policies/global scopes por tenant) + **RLS como defesa adicional** (documentada), não como única camada |
| `webhook_events` ledger | Tabela `webhook_events` (mantida) |

---

## 11. Plano de migração reversível (visão; detalhe em MIGRATION_PLAN.md)

Princípios: **nada destrutivo sem backup**; **React permanece em produção** até paridade verificada por área; cada fase é um PR revisável com testes e evidências; rollback = reverter PR + `docker compose down` (ambiente novo isolado do atual).

- **Reversibilidade de dados:** migração para PostgreSQL próprio é *copy-forward* (dump → import), preservando IDs/relacionamentos; o Supabase original permanece intacto até cutover autorizado.
- **Reversibilidade de billing:** adaptar `BillingProvider` sem apagar nada no Stripe; reconciliação antes de qualquer cutover.
- **Gate de desativação do React:** checklist de paridade (DoD, §11 da missão) + procedimento de cutover documentado (`docs/operations/DEPLOYMENT.md` / `ROLLBACK.md`).

---

## 12. Estimativa atualizada das etapas (até jan/2027)

Premissa: 1 responsável de integração + subagentes. Datas são **estimativas de esforço**, não compromissos — dependem de bloqueios externos (dump do banco, sandbox Stripe/Asaas, credenciais).

| Fase | Entregável | Estimativa |
|---|---|---|
| A — Auditoria + baseline | este AUDIT + baseline de testes verde | **concluída** |
| B — Fundação Angular/Laravel + Sanctum | scaffolding, Docker Compose, auth SPA, CI | ~1,5 semana |
| C — Banco + multi-tenancy | dump→PostgreSQL próprio, domínios, policies, RLS defensivo, testes negativos 2+ orgs | ~2 semanas |
| D — Funcionalidades existentes | agenda, clientes, serviços, profissionais, reserva pública, portal (paridade por área) | ~3 semanas |
| E — Billing (planos/cotas/webhooks) | catálogo no servidor, lifecycle correto, enforcement, reconciliação, sandbox | ~2,5 semanas |
| F — Segurança + E2E + QA visual | rate-limit, IDOR, webhooks, concorrência/timezone, auditoria de deps, Playwright | ~1,5 semana |
| G — Staging + docs operacionais + checklist piloto | staging, DEPLOYMENT/ROLLBACK, ACCEPTANCE_REPORT | ~1 semana |

**Leitura de risco de prazo:** ~11,5 semanas de esforço contínuo. Para o piloto de 15/12/2026, o MVP comercial (§8 da missão) deve ser o foco; módulos avançados (lista de espera, sinal) só se sobrar capacidade.

---

## Bloqueios externos explícitos (a destravar com autorização)

1. **Dump do schema/dados do Supabase vivo** — necessário para modelar o PostgreSQL próprio com as colunas reais (núcleo não versionado). *Sem isto, a Fase C não começa com fidelidade.*
2. **Sandbox Stripe (e avaliação Asaas)** — para testar o ciclo real de billing com eventos válidos/inválidos/duplicados/fora de ordem.
3. **Credenciais WhatsApp/Twilio de teste** — para homologar lembretes/OTP.
4. **Decisão de produto sobre planos/preços** — o catálogo precisa sair do frontend e virar fonte no servidor; confirmar valores oficiais.

Enquanto esses bloqueios não são destravados, a equipe avança no que é tecnicamente seguro: fundação Laravel/Angular, contratos OpenAPI, modelagem de domínios com dados **sintéticos**, e correção isolada dos defeitos de billing com testes.
