<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plan_entitlements', function (Blueprint $table): void {
            $table->unsignedBigInteger('limit_value')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Preservar valores ilimitados: rollback não pode convertê-los em cotas arbitrárias.
    }
};
