<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reserva pública por link + portal do cliente (OTP com sessão opaca).
 * Preserva o modelo do Supabase (SPEC-002/SPEC-007): anti-enumeração, rate-limit,
 * código com hash+pepper, sessão opaca (apenas o hash é guardado).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Configuração de reserva pública por organização.
        Schema::create('public_booking_settings', function (Blueprint $table) {
            $table->uuid('organization_id')->primary();
            $table->boolean('is_enabled')->default(false);
            $table->jsonb('allowed_service_ids')->nullable();      // null = todos
            $table->jsonb('allowed_professional_ids')->nullable(); // null = todos
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
        });

        // Desafios de OTP do portal (código com hash+pepper, expiração e tentativas).
        Schema::create('portal_otp_challenges', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->string('phone_normalized');
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestampTz('expires_at');
            $table->timestampTz('consumed_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->index(['organization_id', 'phone_normalized']);
        });

        // Registro de pedidos de OTP para rate-limit anti-enumeração (por telefone/IP).
        Schema::create('portal_otp_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('phone_hash');
            $table->string('ip_hash');
            $table->timestamps();

            $table->index(['organization_id', 'phone_hash', 'created_at']);
            $table->index(['organization_id', 'ip_hash', 'created_at']);
        });

        // Sessões opacas do portal: apenas o hash do token é persistido.
        Schema::create('portal_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->string('token_hash')->unique();
            $table->timestampTz('expires_at');
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampTz('last_seen_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->index(['organization_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_sessions');
        Schema::dropIfExists('portal_otp_requests');
        Schema::dropIfExists('portal_otp_challenges');
        Schema::dropIfExists('public_booking_settings');
    }
};
