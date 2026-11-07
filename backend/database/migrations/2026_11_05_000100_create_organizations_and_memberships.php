<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-tenancy: a organização é o tenant principal. Memberships explicitam o papel
 * (owner/admin/employee) de cada usuário em cada organização. Preserva o modelo canônico
 * do Supabase (organizations + organization_id), com UUIDs para manter os IDs reais na migração.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->uuid('owner_id');
            $table->string('logo_url')->nullable();
            $table->string('primary_color', 9)->nullable();
            $table->timestamp('onboarding_completed_at')->nullable();
            $table->timestamps();

            $table->foreign('owner_id')->references('id')->on('users')->restrictOnDelete();
            $table->index('owner_id');
        });

        Schema::create('memberships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('user_id');
            // owner | admin | employee — autoridade de papel vive no servidor.
            $table->string('role', 20)->default('employee');
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();

            // Um usuário tem no máximo um vínculo por organização.
            $table->unique(['organization_id', 'user_id']);
            $table->index(['organization_id', 'role']);
        });

        Schema::create('organization_settings', function (Blueprint $table) {
            $table->uuid('organization_id')->primary();
            $table->string('specialty')->nullable();
            $table->string('segment')->nullable();
            $table->string('instagram')->nullable();
            $table->text('bio')->nullable();
            $table->jsonb('address')->nullable();
            $table->string('timezone')->default('America/Sao_Paulo');
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_settings');
        Schema::dropIfExists('memberships');
        Schema::dropIfExists('organizations');
    }
};
