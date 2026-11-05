<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Billing: catálogo de planos como FONTE AUTORITATIVA NO SERVIDOR (corrige "planos/preços
 * definidos no frontend"), versionamento de plano/preço, entitlements (limites de cota),
 * assinaturas com ciclo de vida completo e status canônico ÚNICO, e ledger de webhooks
 * idempotente. Desacoplado do gateway via interface BillingProvider (ver código do módulo).
 *
 * Decisões que corrigem defeitos do AUDIT §5:
 *  - subscription_status é um enum canônico único (sem 'cancelled' vs 'canceled').
 *  - trial_ends_at + trial_used garantem trial NÃO reutilizável indevidamente.
 *  - status 'active' só é gravado por evento autenticado de pagamento confirmado.
 *  - invoices/payments são tabelas de registro (não só colunas na organização).
 *  - usage_counters registram consumo de forma transacional/concorrente.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Catálogo de planos (fonte no servidor). Ex.: starter, pro, clinic.
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();              // starter | pro | clinic
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Versões de plano: preço e identificadores do gateway por período.
        // Troca de preço cria NOVA versão; assinaturas existentes mantêm sua versão.
        Schema::create('plan_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('plan_id');
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('price_cents');        // preço em centavos (BRL)
            $table->string('currency', 3)->default('BRL');
            $table->string('billing_interval', 10)->default('month'); // month | year
            $table->string('gateway')->nullable();         // stripe | asaas
            $table->string('gateway_price_id')->nullable(); // Price ID resolvido no servidor
            $table->boolean('is_current')->default(true);
            $table->timestamps();

            $table->foreign('plan_id')->references('id')->on('plans')->cascadeOnDelete();
            $table->unique(['plan_id', 'version']);
            $table->index(['plan_id', 'is_current']);
        });

        // Entitlements: limites/recursos por versão de plano (enforcement no servidor).
        // value_int null = ilimitado. feature flags via value_bool.
        Schema::create('plan_entitlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('plan_version_id');
            $table->string('key');                          // professionals | monthly_appointments | messages | premium_reports ...
            $table->integer('value_int')->nullable();       // null = ilimitado
            $table->boolean('value_bool')->nullable();
            $table->timestamps();

            $table->foreign('plan_version_id')->references('id')->on('plan_versions')->cascadeOnDelete();
            $table->unique(['plan_version_id', 'key']);
        });

        // Cliente de cobrança do gateway, por organização (1:1).
        Schema::create('billing_customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('gateway');                      // stripe | asaas
            $table->string('gateway_customer_id');
            $table->string('email')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->unique(['organization_id', 'gateway']);
            $table->unique(['gateway', 'gateway_customer_id']);
        });

        // Assinaturas: UMA ativa por organização (índice parcial garante). Status canônico.
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('plan_version_id');
            $table->string('gateway')->nullable();
            $table->string('gateway_subscription_id')->nullable()->unique();
            // Status canônico ÚNICO: incomplete | trialing | active | past_due | grace | suspended | canceled
            $table->string('status', 20)->default('incomplete');
            $table->boolean('trial_used')->default(false);  // impede reinício indevido de trial
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('grace_ends_at')->nullable(); // período de regularização
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamp('canceled_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('plan_version_id')->references('id')->on('plan_versions')->restrictOnDelete();
            $table->index(['organization_id', 'status']);
        });

        // Índice parcial (PostgreSQL): no máximo UMA assinatura "viva" por organização.
        // Corrige o risco de assinaturas duplicadas do AUDIT §5. (SQLite ignora: índice parcial
        // não suportado da mesma forma; a unicidade é reforçada pela aplicação em ambos os casos.)
        if (\Illuminate\Support\Facades\Schema::getConnection()->getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement(<<<'SQL'
                CREATE UNIQUE INDEX subscriptions_one_live_per_org
                ON subscriptions (organization_id)
                WHERE status IN ('incomplete','trialing','active','past_due','grace','suspended')
            SQL);
        }

        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('subscription_id')->nullable();
            $table->string('gateway')->nullable();
            $table->string('gateway_invoice_id')->nullable();
            // open | paid | uncollectible | void | refunded
            $table->string('status', 20)->default('open');
            $table->unsignedInteger('amount_cents');
            $table->string('currency', 3)->default('BRL');
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('subscription_id')->references('id')->on('subscriptions')->nullOnDelete();
            $table->unique(['gateway', 'gateway_invoice_id']);
            $table->index(['organization_id', 'status']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id')->nullable();
            $table->uuid('organization_id');
            $table->string('gateway')->nullable();
            $table->string('gateway_payment_id')->nullable();
            $table->string('method')->nullable();           // card | pix (pix tratado como avulso)
            // pending | confirmed | failed | refunded
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('amount_cents');
            $table->string('currency', 3)->default('BRL');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->foreign('invoice_id')->references('id')->on('invoices')->nullOnDelete();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->unique(['gateway', 'gateway_payment_id']);
        });

        // Ledger de webhooks: idempotência + proteção contra replay/ordem.
        Schema::create('webhook_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider');                     // stripe | asaas
            $table->string('provider_event_id');
            $table->string('event_type');
            // received | processing | processed | failed
            $table->string('status', 20)->default('received');
            $table->string('error_code')->nullable();
            $table->jsonb('payload')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_event_id']);
            $table->index(['provider', 'status']);
        });

        // Contadores de uso por organização/janela (enforcement de cotas concorrente).
        Schema::create('usage_counters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('key');                          // monthly_appointments | messages ...
            $table->string('period');                       // ex.: 2026-11 (mês) ou 'total'
            $table->unsignedBigInteger('value')->default(0);
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->unique(['organization_id', 'key', 'period']);
        });

        // Trilha de auditoria das transições de assinatura.
        Schema::create('subscription_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('subscription_id')->nullable();
            $table->string('action');                       // created | activated | renewed | past_due | suspended | reactivated | upgraded | downgraded | canceled | refunded
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20)->nullable();
            $table->jsonb('context')->nullable();
            $table->uuid('actor_user_id')->nullable();
            $table->string('source')->default('system');    // system | webhook | user
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_audit_logs');
        Schema::dropIfExists('usage_counters');
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('billing_customers');
        Schema::dropIfExists('plan_entitlements');
        Schema::dropIfExists('plan_versions');
        Schema::dropIfExists('plans');
    }
};
