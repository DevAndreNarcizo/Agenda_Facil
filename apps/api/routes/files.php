<?php

declare(strict_types=1);

use App\Domains\Files\PrivateFileController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1')->middleware(['auth:sanctum', 'tenant'])->group(function (): void {
    Route::get('files', [PrivateFileController::class, 'index']);
    Route::post('files', [PrivateFileController::class, 'upload'])->middleware('throttle:30,1');
    Route::get('files/{id}', [PrivateFileController::class, 'download'])->whereUuid('id');
    Route::delete('files/{id}', [PrivateFileController::class, 'delete'])->whereUuid('id');
});
