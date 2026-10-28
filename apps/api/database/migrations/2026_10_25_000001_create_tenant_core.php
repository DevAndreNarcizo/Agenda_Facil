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
        Schema::create('organizations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('owner_id')->constrained('users')->restrictOnDelete();
            $table->string('name', 120);
            $table->string('slug', 80)->unique();
            $table->string('timezone', 80)->default('America/Sao_Paulo');
            $table->string('primary_color', 7)->default('#087BF5');
            $table->boolean('public_booking_enabled')->default(true);
            $table->jsonb('settings')->default('{}');
            $table->timestampTz('onboarding_completed_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('memberships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('user_id')->constrained()->restrictOnDelete();
            $table->string('role', 20);
            $table->string('status', 20)->default('active');
            $table->timestampsTz();
            $table->unique(['organization_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
        DB::statement("ALTER TABLE memberships ADD CONSTRAINT memberships_role_valid CHECK(role IN ('owner','admin','employee')), ADD CONSTRAINT memberships_status_valid CHECK(status IN ('active','revoked'))");
        Schema::create('membership_invitations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->string('email');
            $table->string('role', 20);
            $table->string('token_hash', 64)->unique();
            $table->timestampTz('expires_at');
            $table->timestampTz('accepted_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('business_hours', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->boolean('is_active');
            $table->unique(['organization_id', 'day_of_week']);
        });
        DB::statement('ALTER TABLE business_hours ADD CONSTRAINT business_hours_valid CHECK(day_of_week BETWEEN 0 AND 6 AND end_time > start_time)');
        foreach (['services', 'professionals', 'customers'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
                $table->string('name', 120);
                if ($name === 'services') {
                    $table->unsignedSmallInteger('duration_minutes');
                    $table->unsignedInteger('price_cents');
                }
                if ($name === 'customers') {
                    $table->string('email')->nullable();
                    $table->string('phone', 30)->nullable();
                } else {
                    $table->boolean('is_active')->default(true);
                }
                $table->timestampsTz();
                $table->index(['organization_id', 'name']);
                $table->unique(['id', 'organization_id']);
            });
        }
        DB::statement('ALTER TABLE services ADD CONSTRAINT services_values_valid CHECK(duration_minutes BETWEEN 5 AND 480 AND price_cents >= 0)');
        Schema::create('appointments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->uuid('service_id');
            $table->uuid('professional_id');
            $table->uuid('customer_id');
            $table->timestampTz('start_time');
            $table->timestampTz('end_time');
            $table->unsignedInteger('price_cents');
            $table->string('status', 20)->default('pending');
            $table->string('booking_source', 20)->default('direct');
            $table->string('idempotency_key', 128)->nullable();
            $table->string('request_hash', 64)->nullable();
            $table->string('cancellation_token_hash', 64)->nullable();
            $table->timestampsTz();
            $table->foreign(['service_id', 'organization_id'])->references(['id', 'organization_id'])->on('services')->restrictOnDelete();
            $table->foreign(['professional_id', 'organization_id'])->references(['id', 'organization_id'])->on('professionals')->restrictOnDelete();
            $table->foreign(['customer_id', 'organization_id'])->references(['id', 'organization_id'])->on('customers')->restrictOnDelete();
            $table->index(['organization_id', 'start_time']);
            $table->unique(['organization_id', 'idempotency_key']);
        });
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_values_valid CHECK(end_time > start_time AND price_cents >= 0 AND status IN ('pending','confirmed','completed','cancelled','no_show'))");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap EXCLUDE USING gist (organization_id WITH =, professional_id WITH =, tstzrange(start_time,end_time,'[)') WITH &&) WHERE (status IN ('pending','confirmed','completed'))");
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->nullable()->constrained()->restrictOnDelete();
            $table->uuid('actor_id')->nullable();
            $table->string('action', 80);
            $table->uuid('resource_id')->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->timestampTz('created_at');
            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['audit_logs', 'appointments', 'customers', 'professionals', 'services', 'business_hours', 'membership_invitations', 'memberships', 'organizations'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
