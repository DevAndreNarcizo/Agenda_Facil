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
        Schema::create('appointment_blocks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->uuid('professional_id')->nullable();
            $table->foreign(['professional_id', 'organization_id'])->references(['id', 'organization_id'])->on('professionals')->restrictOnDelete();
            $table->timestampTz('start_time');
            $table->timestampTz('end_time');
            $table->timestampsTz();
            $table->index(['organization_id', 'start_time', 'end_time']);
        });
        DB::statement('ALTER TABLE appointment_blocks ADD CONSTRAINT appointment_blocks_positive_interval CHECK(end_time > start_time)');
        DB::statement('CREATE UNIQUE INDEX appointment_blocks_unique_interval ON appointment_blocks(organization_id, professional_id, start_time, end_time) NULLS NOT DISTINCT');
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_blocks');
    }
};
