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
        Schema::table('subscriptions', fn (Blueprint $table) => $table->unique(['id', 'organization_id']));
        foreach (['invoices', 'subscription_audit_logs', 'billing_checkout_attempts'] as $table) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$table}_subscription_id_foreign");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_subscription_tenant_foreign FOREIGN KEY (subscription_id,organization_id) REFERENCES subscriptions(id,organization_id) ON DELETE RESTRICT");
        }
    }

    public function down(): void
    {
        foreach (['invoices', 'subscription_audit_logs', 'billing_checkout_attempts'] as $table) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$table}_subscription_tenant_foreign");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_subscription_id_foreign FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT");
        }
        Schema::table('subscriptions', fn (Blueprint $table) => $table->dropUnique(['id', 'organization_id']));
    }
};
