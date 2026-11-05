<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Outbox de notificações (lembretes/confirmações). Preserva o modelo do Supabase
 * (SPEC-005): idempotência por (appointment_id, template_name), claim com lease por
 * lock_token, backoff exponencial. Nenhum telefone, corpo de mensagem ou token é persistido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('appointment_id');
            $table->string('channel', 20)->default('whatsapp');     // whatsapp
            $table->string('template_name', 40);                     // appointment_reminder | appointment_confirmation
            // pending | processing | sent | failed | unknown | skipped
            $table->string('status', 20)->default('pending');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->unsignedTinyInteger('max_attempts')->default(3);
            $table->timestampTz('scheduled_for');
            $table->timestampTz('next_attempt_at')->useCurrent();
            $table->uuid('lock_token')->nullable();
            $table->timestampTz('lock_expires_at')->nullable();
            $table->timestampTz('sent_at')->nullable();
            $table->string('last_error_code')->nullable();
            $table->string('provider_message_id')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('appointment_id')->references('id')->on('appointments')->cascadeOnDelete();

            // Idempotência: uma entrega por (agendamento, template).
            $table->unique(['appointment_id', 'template_name']);
            $table->index(['status', 'next_attempt_at', 'scheduled_for']);
            $table->index(['organization_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_deliveries');
    }
};
