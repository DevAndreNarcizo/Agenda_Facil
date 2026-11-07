# ADR-011 — Billing com catálogo no servidor, status canônico e provedor desacoplado

**Status:** aceito
**Data:** 2026-11-05

## Contexto
A auditoria (`docs/migration/AUDIT.md §5`) confirmou 10 defeitos no billing legado (Stripe via Edge Functions): planos/preços no frontend, marcação prematura de `active`, trial reiniciado a cada checkout, inconsistência `cancelled`/`canceled`, risco de assinatura duplicada, ausência de enforcement de limites, estado só em colunas de `organizations`, Pix como assinatura recorrente, e tratamento incompleto de renovação/troca/cancelamento.

## Decisão
Reconstruir o módulo Billing no Laravel com:
- **Catálogo no servidor** (`plans`/`plan_versions`/`plan_entitlements`), versionado por preço.
- **Status canônico único** (`SubscriptionStatus`: incomplete/trialing/active/past_due/grace/suspended/canceled), com conversão de valores de gateway (`cancelled`→`canceled`).
- **`active` só mediante pagamento confirmado** por evento autenticado (nunca no checkout).
- **Trial não reutilizável** (`trial_used`) e **uma assinatura viva por organização** (índice parcial PostgreSQL).
- **Enforcement real de cotas** (`EntitlementService` + `usage_counters` transacionais).
- **Ledger de webhooks** idempotente com tolerância a duplicados/fora de ordem.
- **Pix fora da recorrência** (tratado como pagamento avulso).
- **Interface `BillingProvider`** desacoplando o gateway (Asaas como primeira opção; Stripe suportado; `FakeBillingProvider` para dev/test).

## Consequências
- O ciclo de vida completo (trial → ativo → renovação → falha → regularização → suspensão → reativação → upgrade/downgrade → cancelamento) é coberto por testes (29 testes Pest verdes com o provedor fake).
- A homologação em sandbox Stripe/Asaas é um bloqueio externo (credenciais); a arquitetura permite plugar o provedor real sem reescrever a lógica.
- A migração de assinaturas Stripe existentes exige reconciliação; nada é apagado sem plano.
