# ACCEPTANCE_REPORT — Relatório de aceitação (progressivo)

> Relatório honesto do que foi **comprovado** × o que está **pendente/bloqueado**. Nada é marcado como concluído sem evidência verificada. Atualizado a cada fase.

**Data:** 2026-11-05 · **Branch:** `migracao/saas-angular-laravel`

## Evidências executadas neste ambiente

### Frontend React (baseline — sistema atual preservado)
- `npm run lint` → ✅ limpo
- `npx tsc -b` → ✅ limpo
- `npm test` (vitest) → ✅ **31 testes / 10 arquivos**
- `npm audit --omit=dev --audit-level=high` → ✅ **0 vulnerabilidades** (zod atualizado p/ ≥4.6.6, CVE high corrigida)

### CI (GitHub Actions) — verde no último commit da branch
- **Qualidade** (React): lint + test + build + audit → ✅ (corrigido bug pré-existente de `secrets` em `if` de job)
- **Backend (Laravel)**: Pint + migrações + Pest contra **PostgreSQL 18** → ✅ (validou índice parcial e constraint EXCLUDE)
- **Frontend Angular**: build de produção + testes → ✅

### Backend Laravel (novo — Fases B/E/D + PublicBooking/Portal)
- `./vendor/bin/pint --test` → ✅ estilo limpo
- `php artisan test` (Pest) → ✅ **64 testes / 206 asserções**
  - (além dos anteriores) Reserva pública/Portal: contexto por slug, anti-enumeração de OTP, OTP inválido rejeitado, sessão opaca exigida, isolamento de sessão entre organizações
- CI: `backend.yml` (PostgreSQL 18) e `frontend-angular.yml` adicionados
  - Auth/provisionamento (owner, transacional, isolamento 2 orgs, slug único)
  - Billing: incompleta→ativa só com pagamento; trial não reinicia; sem duplicidade; grace→suspensão automática; cancelamento imediato/fim de período; upgrade/downgrade auditado
  - Webhook: idempotência, fora de ordem, assinatura inválida rejeitada
  - Agenda: anti-overlap (sobreposição, adjacência, profissionais distintos, cancelado ignorado), remarcação com conflito, intervalo inválido
  - Cotas: profissionais e agendamentos/mês barrados ao estourar; ilimitado respeitado
  - API HTTP: catálogo de planos, cadastro, checkout owner-only, webhook assinado ativa; CRUD operacional; guard de assinatura (402); anti-IDOR entre 2 orgs
  - Lembretes (outbox): enfileiramento idempotente, envio com marcação, pular se não-confirmado, backoff em falha, sem reenvio duplicado
- `php artisan migrate --seed` → ✅ migrações + `PlanCatalogSeeder` aplicam (validado em SQLite)

### E2E (Playwright — fluxo de piloto) → ✅ **3 testes passando no CI**
- `frontend-angular/e2e/pilot-flow.spec.ts`: (1) cadastro→onboarding→agenda (cria agendamento); (2) link público indisponível; (3) reserva pública via OTP→sessão opaca→confirmação.
- Executado vivo no **CI** (job `e2e` do workflow Angular): Playwright sobe o backend Laravel (SQLite efêmero, `php -S`, migrado + DemoSeeder) e `ng serve`. O sandbox local não sustenta servidores em background entre comandos, então a execução viva é no CI.
- Cadastro agora concede **trial automático** (plano Starter) → acesso imediato ao MVP sem checkout manual.

## Definition of Done (§11 da missão) — rastreamento

| Critério | Estado | Observação |
|---|---|---|
| Organização consegue se cadastrar | 🟡 backend pronto e testado | UI Angular pendente (Fase D) |
| Proprietário conclui onboarding | ✅ comprovado | endpoint transacional + página Angular; testado |
| Profissionais e serviços cadastrados | ✅ comprovado | API + cota; UI Angular (CRUD) entregue |
| Cliente externo reserva | ✅ comprovado | OTP→sessão opaca→reserva; UI Angular `/reservar/:slug` entregue; isolamento de token testado |
| Agendamento aparece na agenda | ✅ backend comprovado | `GET /appointments`; criação anti-overlap |
| Plano reconhecido pelo servidor | ✅ comprovado | catálogo no servidor + `GET /subscription` |
| Cobrança sandbox confirmada | 🟡 fluxo provado com provedor **fake** | sandbox Stripe/Asaas bloqueado (credenciais) |
| Fluxo de piloto ponta a ponta (E2E) | ✅ Playwright 3/3 no CI | cadastro→onboarding→agenda; reserva pública OTP |
| Renovação/falha/troca/cancelamento | ✅ comprovado (serviço + webhook) | com provedor fake; revalidar em sandbox real |
| Limites não podem ser burlados | ✅ comprovado | cotas aplicadas a profissionais e agendamentos reais |
| Org não acessa dados de outra | ✅ comprovado | teste anti-IDOR HTTP (2 orgs) + isolamento no provisionamento |
| Angular nos principais tamanhos de tela | 🟡 responsivo (grids auto-fit) + tokens af-* light/dark | QA visual fino pendente |
| Builds/testes/CI aprovados | ✅ comprovado | 3 workflows verdes (Qualidade/Backend-PostgreSQL/Angular) |
| Backups restauráveis | ✅ round-trip lógico testado no CI | físico (pg_dump/restore) via scripts; validar em staging |
| Produção inalterada | ✅ garantido | nada remoto tocado |

Legenda: ✅ comprovado · 🟡 parcial/provado em dev · ⬜ não iniciado · ⛔ bloqueado

## Bloqueios externos (impedem comprovação total)

1. Dump do Supabase vivo (Fase C).
2. Sandbox Stripe/Asaas (ciclo real de billing).
3. Credenciais WhatsApp/Twilio (lembretes/OTP).
4. Runtime de containers indisponível neste sandbox (PostgreSQL validado via setup entregue, loop de testes em SQLite).

## Conclusão honesta

O **núcleo de risco** (multi-tenancy seguro + billing correto com cotas, sem os 10 defeitos do AUDIT) está implementado e **comprovado por testes** no backend Laravel, agora validado em **CI contra PostgreSQL 18**. O fluxo comercial central também está no backend: cadastro/onboarding, serviços/profissionais/clientes, agenda com anti-overlap, **reserva pública por link + portal do cliente (OTP + sessão opaca)**, e assinatura com cotas. A fundação Angular 22 está de pé (build + testes em CI).

Pendente para a Definition of Done completa: migração das 12 áreas Angular com paridade visual e E2E, migração de dados do Supabase (bloqueio externo), homologação do billing em sandbox real (Stripe/Asaas), backups restauráveis (Fase G) e QA visual. O produto **ainda não** cumpre a DoD completa — declarado explicitamente, conforme exigido.
