<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['customer_portal_login_tokens', 'customer_portal_sessions'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
                $table->uuid('customer_id');
                $table->foreign(['customer_id', 'organization_id'])->references(['id', 'organization_id'])->on('customers')->restrictOnDelete();
                $table->string('token_hash', 64)->unique();
                $table->string('email_hash', 64);
                $table->timestampTz('expires_at');
                $table->timestampTz($name === 'customer_portal_login_tokens' ? 'consumed_at' : 'revoked_at')->nullable();
                $table->timestampTz('created_at');
                $table->index(['organization_id', 'customer_id', 'expires_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_portal_sessions');
        Schema::dropIfExists('customer_portal_login_tokens');
    }
};
