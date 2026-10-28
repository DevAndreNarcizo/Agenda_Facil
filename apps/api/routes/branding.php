<?php

declare(strict_types=1);

use App\Domains\Organizations\BrandingController;
use Illuminate\Support\Facades\Route;

Route::get('api/v1/public/{slug}/logo', [BrandingController::class, 'publicLogo'])->middleware('throttle:public');
Route::prefix('api/v1/branding')->middleware(['auth:sanctum', 'tenant'])->group(function (): void {
    Route::post('logo', [BrandingController::class, 'upload'])->middleware('throttle:30,1');
    Route::delete('logo', [BrandingController::class, 'clear']);
});
