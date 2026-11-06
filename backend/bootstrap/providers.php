<?php

use App\Providers\AppServiceProvider;
use Modules\Billing\BillingServiceProvider;
use Modules\Notifications\NotificationsServiceProvider;
use Modules\Operations\OperationsServiceProvider;

return [
    AppServiceProvider::class,
    BillingServiceProvider::class,
    NotificationsServiceProvider::class,
    OperationsServiceProvider::class,
];
