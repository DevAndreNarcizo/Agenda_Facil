<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Núcleo operacional da agenda: serviços, profissionais, clientes e agendamentos.
 * Preserva o modelo canônico do Supabase (tudo escopado por organization_id).
 *
 * Garantia crítica (SPEC-004 / missão §9): sem agendamentos sobrepostos para o mesmo
 * profissional. Em PostgreSQL usamos EXCLUDE com tstzrange (defesa transacional no banco);
 * a aplicação também valida (defesa em profundidade). Em SQLite o EXCLUDE é ignorado e a
 * regra é garantida pela aplicação (lock + verificação), coberta por testes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->string('category')->nullable();
            $table->unsignedInteger('duration_minutes');
            $table->unsignedInteger('price_cents')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'is_active']);
        });

        // Profissional que atende (pode ou não estar vinculado a um usuário/membership).
        Schema::create('professionals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('user_id')->nullable(); // vínculo opcional a um membro da equipe
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['organization_id', 'is_active']);
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('phone_normalized')->nullable();
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->index(['organization_id', 'name']);
            $table->index(['organization_id', 'phone_normalized']);
        });

        Schema::create('appointments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('service_id')->nullable();
            $table->uuid('professional_id')->nullable();
            $table->uuid('customer_id')->nullable();
            $table->timestampTz('start_time');
            $table->timestampTz('end_time');
            // pending | confirmed | completed | cancelled
            $table->string('status', 20)->default('pending');
            // direct | instagram | google | qr | site | referral
            $table->string('booking_source', 20)->default('direct');
            $table->boolean('is_blocked')->default(false); // bloqueio de horário (não é atendimento)
            $table->timestampTz('reminder_sent_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('service_id')->references('id')->on('services')->nullOnDelete();
            $table->foreign('professional_id')->references('id')->on('professionals')->nullOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();

            $table->index(['organization_id', 'start_time']);
            $table->index(['organization_id', 'professional_id', 'start_time']);
        });

        // Anti-overlap transacional no PostgreSQL: nenhum agendamento ativo do mesmo
        // profissional pode ter interseção de intervalo [start_time, end_time).
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
            DB::statement(<<<'SQL'
                ALTER TABLE appointments
                ADD CONSTRAINT appointments_no_overlap
                EXCLUDE USING gist (
                    professional_id WITH =,
                    tstzrange(start_time, end_time, '[)') WITH &&
                )
                WHERE (status <> 'cancelled' AND professional_id IS NOT NULL)
            SQL);
            DB::statement('ALTER TABLE appointments ADD CONSTRAINT appointments_valid_range CHECK (end_time > start_time)');
        }

        Schema::create('business_hours', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->unsignedTinyInteger('day_of_week'); // 0=domingo .. 6=sábado
            $table->time('start_time');
            $table->time('end_time');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->unique(['organization_id', 'day_of_week']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_hours');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('professionals');
        Schema::dropIfExists('services');
    }
};
