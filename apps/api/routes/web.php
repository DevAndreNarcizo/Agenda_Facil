<?php

declare(strict_types=1);

use App\Domains\Analytics\AnalyticsController;
use App\Domains\Billing\Http\AsaasWebhookController;
use App\Domains\Billing\Http\BillingController;
use App\Domains\Identity\AuthController;
use App\Domains\Memberships\MembershipController;
use App\Domains\Organizations\OrganizationController;
use App\Domains\PublicBooking\PublicBookingController;
use App\Domains\Scheduling\AppointmentController;
use App\Domains\Scheduling\BlockController;
use App\Domains\Services\CatalogController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['name' => 'Agenda Fácil API', 'version' => 'v1']));
Route::prefix('api/v1')->group(function (): void {
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:auth');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:auth');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:auth');
    Route::get('plans', [BillingController::class, 'plans']);
    Route::get('billing/plans', [BillingController::class, 'plans']);
    Route::post('billing/webhooks/asaas', [AsaasWebhookController::class, '__invoke'])->middleware('throttle:webhooks');
    Route::get('public/{slug}', [PublicBookingController::class, 'context'])->middleware('throttle:public');
    Route::get('public/{slug}/availability', [PublicBookingController::class, 'availability'])->middleware('throttle:public');
    Route::post('public/{slug}/bookings', [PublicBookingController::class, 'book'])->middleware('throttle:bookings');
    Route::post('public/{slug}/bookings/{id}/cancel', [PublicBookingController::class, 'cancel'])->middleware('throttle:bookings');
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/user', [AuthController::class, 'user']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('onboarding', [OrganizationController::class, 'onboarding'])->middleware('throttle:onboarding');
        Route::get('organizations', [OrganizationController::class, 'index']);
        Route::post('organizations/activate', [OrganizationController::class, 'activate'])->middleware('throttle:tenant-switch');
        Route::post('memberships/accept', [MembershipController::class, 'accept'])->middleware('throttle:membership-accept');
        Route::middleware('tenant')->group(function (): void {
            Route::get('dashboard', [AnalyticsController::class, 'dashboard']);
            Route::get('analytics', [AnalyticsController::class, 'summary']);
            Route::get('export', [AnalyticsController::class, 'export']);
            Route::get('settings', [OrganizationController::class, 'settings']);
            Route::patch('settings', [OrganizationController::class, 'update']);
            Route::get('memberships', [MembershipController::class, 'index']);
            Route::get('memberships/invitations', [MembershipController::class, 'invitations']);
            Route::post('memberships/invitations', [MembershipController::class, 'invite']);
            Route::delete('memberships/invitations/{id}', [MembershipController::class, 'revokeInvitation'])->whereUuid('id');
            Route::delete('memberships/{id}', [MembershipController::class, 'revoke']);
            Route::post('memberships/transfer', [MembershipController::class, 'transfer']);
            Route::get('appointments', [AppointmentController::class, 'index']);
            Route::get('appointment-blocks', [BlockController::class, 'index']);
            Route::post('appointment-blocks', [BlockController::class, 'store']);
            Route::delete('appointment-blocks/{id}', [BlockController::class, 'destroy']);
            Route::post('appointments', [AppointmentController::class, 'store']);
            Route::patch('appointments/{id}', [AppointmentController::class, 'update']);
            Route::get('billing/subscription', [BillingController::class, 'subscription']);
            Route::get('billing/invoices', [BillingController::class, 'invoices']);
            Route::post('billing/checkout', [BillingController::class, 'checkout']);
            Route::post('billing/change-plan', [BillingController::class, 'changePlan']);
            Route::post('billing/cancel', [BillingController::class, 'cancel']);
            Route::get('{resource}', [CatalogController::class, 'index'])->whereIn('resource', ['services', 'professionals', 'customers']);
            Route::post('{resource}', [CatalogController::class, 'store'])->whereIn('resource', ['services', 'professionals', 'customers']);
            Route::patch('{resource}/{id}', [CatalogController::class, 'update'])->whereIn('resource', ['services', 'professionals', 'customers']);
            Route::delete('{resource}/{id}', [CatalogController::class, 'destroy'])->whereIn('resource', ['services', 'professionals', 'customers']);
        });
    });
});

require __DIR__.'/customer-portal.php';
require __DIR__.'/files.php';
require __DIR__.'/branding.php';
