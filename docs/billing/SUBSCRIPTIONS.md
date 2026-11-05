# SUBSCRIPTIONS — Módulo de Assinaturas (Laravel)

> Desenho e estado do módulo Billing no backend Laravel. Corrige os 10 defeitos do `docs/migration/AUDIT.md §5`.
> Código em `backend/app/Modules/Billing/`. Testes em `backend/tests/Feature/Billing/` e `tests/Feature/Api/`.

## Fonte autoritativa no servidor

Planos, preços e limites (**entitlements**) vivem no banco (`plans`, `plan_versions`, `plan_entitlements`), semeados por `PlanCatalogSeeder`. O frontend **consome** `GET /api/v1/plans` — não define mais preço (corrige "planos/preços no frontend"). Preço é versionado: mudança de preço cria uma nova `plan_version`; assinaturas existentes mantêm a versão contratada.

## Entidades (migration `2026_11_05_000200_create_billing_tables.php`)

`plans` · `plan_versions` · `plan_entitlements` · `subscriptions` · `billing_customers` · `invoices` · `payments` · `webhook_events` · `usage_counters` · `subscription_audit_logs`.

## Status canônico ÚNICO

`Modules\Billing\Enums\SubscriptionStatus`: `incomplete · trialing · active · past_due · grace · suspended · canceled`.
`fromGateway()` converge `'cancelled'` (legado) e `'canceled'` (Stripe) para `Canceled` — elimina a inconsistência do AUDIT §5.

`grantsPaidAccess()` = `trialing | active | grace`. `grace` = período de regularização com acesso preservado.

## Ciclo de vida (`SubscriptionService`)

| Operação | Regra |
|---|---|
| `startCheckout` | cria/**reaproveita** a assinatura viva em `incomplete` (índice parcial `subscriptions_one_live_per_org` impede duplicidade) |
| `beginTrial` | só se `trial_used=false` → **trial não reinicia** a cada checkout |
| `activateFromConfirmedPayment` | `active` **só** por pagamento confirmado (nunca no checkout) |
| `renew` | estende período vigente |
| `markPastDue` | → `grace` + `grace_ends_at` (acesso preservado na regularização) |
| `suspendExpiredGrace` | job periódico: `grace` expirado → `suspended` (sem acesso pago) |
| `reactivate` | regularização/renovação a partir de `suspended`/`grace` |
| `changePlan` | upgrade/downgrade, auditado |
| `cancel` | imediato ou ao fim do período |

Toda transição grava em `subscription_audit_logs`.

## Enforcement de cotas (`EntitlementService`)

- `limitFor(org, key)` lê o entitlement da versão de plano da assinatura viva; `null = ilimitado`.
- `ensureWithinLimit(...)` barra criação além do limite (ex.: profissionais).
- `consumeMonthly(...)` incrementa `usage_counters` sob transação + `lockForUpdate` (concorrência segura) e barra ao estourar (ex.: agendamentos/mês, mensagens).

Chaves: `professionals`, `monthly_appointments`, `messages`, `premium_reports`.

## Webhooks (`WebhookProcessor` + `WebhookController`)

- Assinatura/origem validada pelo `BillingProvider` (rejeita forjado → 400).
- Idempotência via `webhook_events` (unique `provider + provider_event_id`): duplicado retorna `duplicate`, não reprocessa.
- Tolera fora de ordem: eventos desconhecidos são registrados sem efeito; falha posterior move para `grace` sem derrubar histórico.
- `invoices`/`payments` registrados por `updateOrCreate` (idempotente).

## Desacoplamento de gateway (`BillingProvider`)

Interface `Modules\Billing\Contracts\BillingProvider` (`createCheckoutSession`, `parseWebhook`, `cancelSubscription`). Implementações:
- **`FakeBillingProvider`** — sintético, determinístico, para dev/test sem dependência externa (ativo por padrão).
- **Stripe / Asaas** — stubs previstos no `BillingServiceProvider`; exigem SDK + credenciais (bloqueio externo). Asaas é a primeira opção comercial, condicionada à homologação.

## Pix

O checkout **não** habilita Pix como método recorrente (corrige AUDIT §5). Pix deve ser tratado como pagamento avulso; renovação automática usa cartão. A tabela `payments.method` registra o meio por cobrança.

## Evidência de testes (sandbox, SQLite em memória)

29 testes Pest, 72 asserções, **todos passando** (`php artisan test`). Cobrem: incompleta→ativa só com pagamento; trial não reinicia; sem duplicidade; grace→suspensão automática; cancelamento imediato/fim de período; upgrade/downgrade auditado; webhook idempotente/fora de ordem/assinatura inválida; checkout owner-only; status canônico.

## Pendências / bloqueios

- Teste do ciclo real em **sandbox Stripe/Asaas** com eventos válidos/inválidos/duplicados/fora de ordem (bloqueio externo: credenciais).
- Reconciliação periódica contra o gateway (job) — a projetar na integração real.
- Migração de assinaturas Stripe existentes: inventariar antes; não excluir cliente/assinatura/histórico sem plano de reconciliação.
