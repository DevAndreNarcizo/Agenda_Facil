<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_synthetic')->default(false);
            $table->timestampsTz();
        });
        Schema::create('plan_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('plan_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->unsignedInteger('price_cents');
            $table->char('currency', 3)->default('BRL');
            $table->string('interval', 10)->default('monthly');
            $table->unsignedSmallInteger('trial_days')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->unique(['plan_id', 'version']);
        });
        Schema::create('plan_entitlements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('plan_version_id')->constrained()->restrictOnDelete();
            $table->string('resource', 50);
            $table->unsignedBigInteger('limit_value');
            $table->unique(['plan_version_id', 'resource']);
        });
        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('plan_version_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('pending_plan_version_id')->nullable()->constrained('plan_versions')->restrictOnDelete();
            $table->string('status', 20)->default('pending');
            $table->string('provider', 30)->nullable();
            $table->string('provider_subscription_id')->nullable();
            $table->timestampTz('trial_used_at')->nullable();
            $table->timestampTz('trial_ends_at')->nullable();
            $table->timestampTz('current_period_start')->nullable();
            $table->timestampTz('current_period_end')->nullable();
            $table->timestampTz('grace_ends_at')->nullable();
            $table->timestampTz('canceled_at')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestampsTz();
            $table->unique(['provider', 'provider_subscription_id']);
        });
        Schema::create('billing_customers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->string('provider', 30);
            $table->string('provider_customer_id');
            $table->timestampsTz();
            $table->unique(['organization_id', 'provider']);
            $table->unique(['provider', 'provider_customer_id']);
        });
        Schema::create('invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('subscription_id')->constrained()->restrictOnDelete();
            $table->string('provider', 30);
            $table->string('provider_invoice_id');
            $table->string('status', 20);
            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3)->default('BRL');
            $table->date('due_date');
            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();
            $table->unique(['provider', 'provider_invoice_id']);
            $table->index(['organization_id', 'due_date']);
            $table->unique(['id', 'organization_id']);
        });
        Schema::create('payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->uuid('invoice_id');
            $table->foreign(['invoice_id', 'organization_id'])->references(['id', 'organization_id'])->on('invoices')->restrictOnDelete();
            $table->string('provider', 30);
            $table->string('provider_payment_id');
            $table->string('status', 30);
            $table->unsignedInteger('amount_cents');
            $table->unsignedInteger('refunded_cents')->default(0);
            $table->timestampsTz();
            $table->unique(['provider', 'provider_payment_id']);
        });
        Schema::create('webhook_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('provider', 30);
            $table->string('provider_event_id');
            $table->string('event_type', 80);
            $table->string('payload_hash', 64);
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestampTz('processed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['provider', 'provider_event_id']);
        });
        Schema::create('usage_counters', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->string('resource', 50);
            $table->string('period', 10);
            $table->unsignedBigInteger('consumed')->default(0);
            $table->timestampsTz();
            $table->unique(['organization_id', 'resource', 'period']);
        });
        Schema::create('subscription_audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('subscription_id')->constrained()->restrictOnDelete();
            $table->string('action', 80);
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->string('provider_event_id')->nullable();
            $table->timestampTz('created_at');
            $table->index(['organization_id', 'created_at']);
        });
        Schema::create('billing_checkout_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('subscription_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('plan_version_id')->constrained()->restrictOnDelete();
            $table->string('idempotency_key', 80);
            $table->string('status', 20)->default('pending');
            $table->string('provider_checkout_id')->nullable();
            $table->text('url')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'idempotency_key']);
        });
        DB::statement("ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('pending','trialing','active','past_due','suspended','canceled'))");
        DB::statement("ALTER TABLE plan_versions ADD CONSTRAINT plan_versions_values_check CHECK (price_cents >= 0 AND trial_days >= 0 AND interval IN ('monthly','yearly'))");
        DB::statement('ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_nonnegative CHECK (consumed >= 0)');
        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_values_check CHECK (amount_cents >= 0 AND refunded_cents >= 0 AND refunded_cents <= amount_cents)');
        DB::statement("CREATE UNIQUE INDEX billing_checkout_one_open ON billing_checkout_attempts (organization_id) WHERE status IN ('pending','ready','uncertain')");
    }

    public function down(): void
    {
        foreach (['billing_checkout_attempts', 'subscription_audit_logs', 'usage_counters', 'webhook_events', 'payments', 'invoices', 'billing_customers', 'subscriptions', 'plan_entitlements', 'plan_versions', 'plans'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
