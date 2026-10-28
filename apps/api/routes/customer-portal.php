<?php

declare(strict_types=1);

use App\Domains\CustomerPortal\PortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/public/{slug}/portal')->group(function (): void {
    Route::post('request', [PortalController::class, 'requestAccess'])->middleware('throttle:3,1');
    Route::post('verify', [PortalController::class, 'verify'])->middleware('throttle:5,1');
    Route::get('appointments', [PortalController::class, 'appointments'])->middleware('throttle:60,1');
    Route::post('bookings', [PortalController::class, 'book'])->middleware('throttle:10,1');
    Route::post('appointments/{id}/cancel', [PortalController::class, 'cancel'])->middleware('throttle:10,1');
    Route::post('logout', [PortalController::class, 'logout'])->middleware('throttle:10,1');
});
