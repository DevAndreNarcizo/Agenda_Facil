<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->string('category', 80)->nullable();
        });
        Schema::table('membership_invitations', function (Blueprint $table): void {
            $table->string('idempotency_key', 128)->nullable();
            $table->string('request_hash', 64)->nullable();
            $table->unique(['organization_id', 'idempotency_key'], 'membership_invites_idempotency');
            $table->index(['organization_id', 'email', 'accepted_at', 'revoked_at'], 'membership_invites_tenant_email');
        });
        Schema::table('memberships', function (Blueprint $table): void {
            $table->index(['organization_id', 'status', 'role'], 'memberships_tenant_status_role');
        });
    }

    public function down(): void
    {
        Schema::table('memberships', function (Blueprint $table): void {
            $table->dropIndex('memberships_tenant_status_role');
        });
        Schema::table('membership_invitations', function (Blueprint $table): void {
            $table->dropIndex('membership_invites_tenant_email');
            $table->dropUnique('membership_invites_idempotency');
            $table->dropColumn(['idempotency_key', 'request_hash']);
        });
        Schema::table('services', function (Blueprint $table): void {
            $table->dropColumn('category');
        });
    }
};
