<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('professionals', function (Blueprint $table): void {
            $table->foreignUuid('membership_id')->nullable()->unique()->constrained('memberships')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('professionals', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('membership_id');
        });
    }
};
