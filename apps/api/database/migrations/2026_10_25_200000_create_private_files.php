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
        Schema::create('private_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('disk', 60);
            $table->string('path')->unique();
            $table->string('mime_type', 30);
            $table->unsignedInteger('size_bytes');
            $table->string('sha256', 64);
            $table->timestampsTz();
            $table->index(['organization_id', 'created_at']);
        });
        DB::statement("ALTER TABLE private_files ADD CONSTRAINT private_files_image_valid CHECK (mime_type IN ('image/png','image/jpeg','image/webp') AND size_bytes > 0 AND size_bytes <= 2097152)");
    }

    public function down(): void
    {
        Schema::dropIfExists('private_files');
    }
};
