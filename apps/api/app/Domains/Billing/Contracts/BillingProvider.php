<?php

declare(strict_types=1);

namespace App\Domains\Billing\Contracts;

interface BillingProvider
{
    public function name(): string;

    public function assertAvailable(): void;

    /** @return array{id:string,url:string,expires_at:string} */
    public function checkout(object $subscription, object $planVersion, string $reference): array;

    /** @return array<string, mixed> Authoritative current provider payment, without card data. */
    public function payment(string $paymentId): array;

    /** @return list<array{id:string}> */
    public function payments(string $subscriptionId): array;

    public function changePlan(object $subscription, object $planVersion): void;

    public function cancel(object $subscription, bool $atPeriodEnd): void;
}
