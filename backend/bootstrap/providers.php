<?php

use App\Providers\AppServiceProvider;
use Modules\Billing\BillingServiceProvider;
use Modules\Notifications\NotificationsServiceProvider;

return [
    AppServiceProvider::class,
    BillingServiceProvider::class,
    NotificationsServiceProvider::class,
];
