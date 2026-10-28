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
        Schema::table('private_files', function (Blueprint $table): void {
            $table->unique(['id', 'organization_id'], 'private_files_id_tenant_unique');
        });
        Schema::table('organizations', function (Blueprint $table): void {
            $table->uuid('logo_file_id')->nullable();
        });
        DB::statement('ALTER TABLE organizations ADD CONSTRAINT organization_logo_same_tenant FOREIGN KEY (logo_file_id, id) REFERENCES private_files(id, organization_id) ON DELETE RESTRICT');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE organizations DROP CONSTRAINT organization_logo_same_tenant');
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('logo_file_id'));
        Schema::table('private_files', fn (Blueprint $table) => $table->dropUnique('private_files_id_tenant_unique'));
    }
};
