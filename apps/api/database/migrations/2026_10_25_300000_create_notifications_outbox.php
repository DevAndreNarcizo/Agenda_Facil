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
        Schema::table('appointments', function (Blueprint $table): void {
            $table->unique(['id', 'organization_id'], 'appointments_id_tenant_notifications');
            $table->timestampTz('reminder_sent_at')->nullable();
        });
        Schema::create('message_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->uuid('appointment_id');
            $table->foreign(['appointment_id', 'organization_id'])->references(['id', 'organization_id'])->on('appointments')->restrictOnDelete();
            $table->string('channel', 20);
            $table->string('template_name', 60);
            $table->timestampTz('appointment_start_time');
            $table->timestampTz('due_at');
            $table->string('status', 20)->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestampTz('next_attempt_at');
            $table->uuid('lease_token')->nullable();
            $table->timestampTz('lease_expires_at')->nullable();
            $table->timestampTz('dispatch_started_at')->nullable();
            $table->timestampTz('quota_reserved_at')->nullable();
            $table->string('provider_message_id', 200)->nullable();
            $table->string('error_code', 60)->nullable();
            $table->timestampTz('sent_at')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'appointment_id', 'template_name', 'channel'], 'message_deliveries_dedupe');
            $table->index(['status', 'due_at', 'next_attempt_at']);
            $table->index(['organization_id', 'created_at']);
        });
        DB::statement("ALTER TABLE message_deliveries ADD CONSTRAINT message_delivery_status_valid CHECK(status IN ('pending','processing','sent','failed','unknown','cancelled'))");
        DB::statement("ALTER TABLE message_deliveries ADD CONSTRAINT message_delivery_template_valid CHECK(channel = 'whatsapp' AND template_name = 'appointment_reminder')");
        DB::statement("ALTER TABLE message_deliveries ADD CONSTRAINT message_delivery_lease_valid CHECK((status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL))");
        DB::statement("ALTER TABLE message_deliveries ADD CONSTRAINT message_delivery_sent_valid CHECK(status <> 'sent' OR (sent_at IS NOT NULL AND provider_message_id IS NOT NULL))");
    }

    public function down(): void
    {
        Schema::dropIfExists('message_deliveries');
        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropColumn('reminder_sent_at');
            $table->dropUnique('appointments_id_tenant_notifications');
        });
    }
};
