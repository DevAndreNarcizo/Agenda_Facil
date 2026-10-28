<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Billing\Services\BillingCatalog;
use App\Domains\Billing\Services\EntitlementService;
use App\Domains\Billing\Services\SubscriptionMaintenance;
use App\Domains\Billing\Services\SubscriptionService;
use App\Domains\Billing\Services\TrialService;
use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

final class BillingTest extends TestCase
{
    use RefreshDatabase;

    private array $providerPayments = [];

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['billing.enabled' => false, 'billing.homologated' => false, 'billing.local_fixtures' => true]);
        $this->travelTo(now()->setDate(2026, 10, 15)->setTime(12, 0));
    }

    public function test_catalog_uses_server_versions_and_explicit_synthetic_prices(): void
    {
        $this->getJson('/api/v1/plans')->assertOk()->assertJsonPath('data.0.synthetic', true)->assertJsonPath('data.0.currency', 'BRL');
        $this->assertDatabaseCount('plans', 3);
        $this->getJson('/api/v1/plans')->assertOk();
        $this->assertDatabaseCount('plan_versions', 3);
        Http::assertNothingSent();
    }

    public function test_trial_is_idempotent_and_cannot_be_restarted_after_expiry(): void
    {
        [, $org] = $this->tenant();
        $first = app(TrialService::class)->start($org);
        $this->travel(30)->days();
        $again = app(TrialService::class)->start($org, 'pro');
        $this->assertSame($first->id, $again->id);
        $this->assertSame($first->trial_ends_at, $again->trial_ends_at);
        $this->assertSame($first->plan_version_id, $again->plan_version_id);
        $this->assertFalse(app(SubscriptionService::class)->summary($org)['has_access']);
        $this->assertDatabaseCount('subscriptions', 1);
    }

    public function test_checkout_disabled_fails_closed_without_network_or_early_activation(): void
    {
        [$user, $org] = $this->tenant();
        $this->actingAs($user)->withSession(['organization_id' => $org])->withHeader('Idempotency-Key', 'checkout_synthetic_0001')
            ->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter'])->assertStatus(503);
        $this->assertDatabaseCount('billing_checkout_attempts', 0);
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'trialing']);
        Http::assertNothingSent();
    }

    public function test_owner_only_and_tenant_or_price_spoofing_are_rejected(): void
    {
        [$user, $org] = $this->tenant();
        Membership::where('user_id', $user->id)->update(['role' => 'admin']);
        $this->actingAs($user)->withSession(['organization_id' => $org])->withHeader('Idempotency-Key', 'checkout_synthetic_0002')
            ->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter'])->assertForbidden();
        Membership::where('user_id', $user->id)->update(['role' => 'owner']);
        $this->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter', 'price_cents' => 1, 'organization_id' => (string) Str::uuid()])->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_checkout_retry_returns_same_url_without_restarting_trial_or_creating_subscription(): void
    {
        [$user, $org] = $this->tenant();
        $this->enableProvider();
        Http::fake(['api-sandbox.asaas.com/v3/checkouts' => Http::response(['id' => 'checkout_synthetic'], 200)]);
        $trialEnd = DB::table('subscriptions')->where('organization_id', $org)->value('trial_ends_at');
        $this->actingAs($user)->withSession(['organization_id' => $org])->withHeader('Idempotency-Key', 'checkout_synthetic_0003');
        $one = $this->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter'])->assertOk();
        $two = $this->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter'])->assertOk();
        $this->assertSame($one->json('data'), $two->json('data'));
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request['items'][0]['value'] === 39 && $request['billingTypes'] === ['CREDIT_CARD']);
        $this->assertDatabaseCount('subscriptions', 1);
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'trialing', 'trial_ends_at' => $trialEnd]);
        $this->withHeader('Idempotency-Key', 'checkout_synthetic_0004')->postJson('/api/v1/billing/checkout', ['plan_code' => 'pro'])->assertConflict();
        Http::assertSentCount(1);
    }

    public function test_uncertain_checkout_is_not_retried_and_can_not_duplicate_recurring_charge(): void
    {
        [$user, $org] = $this->tenant();
        $this->enableProvider();
        Http::fake(['api-sandbox.asaas.com/v3/checkouts' => Http::response([], 500)]);
        $this->actingAs($user)->withSession(['organization_id' => $org])->withHeader('Idempotency-Key', 'checkout_synthetic_0005');
        $this->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter'])->assertStatus(503);
        $this->postJson('/api/v1/billing/checkout', ['plan_code' => 'starter'])->assertConflict();
        $this->assertDatabaseHas('billing_checkout_attempts', ['organization_id' => $org, 'status' => 'uncertain']);
        Http::assertSentCount(1);
    }

    public function test_webhook_rejects_invalid_token_and_unconfigured_provider(): void
    {
        $this->postJson('/api/v1/billing/webhooks/asaas', [])->assertStatus(503);
        config(['billing.asaas.webhook_token' => str_repeat('synthetic', 5)]);
        $this->withHeader('asaas-access-token', 'invalid')->postJson('/api/v1/billing/webhooks/asaas', [])->assertUnauthorized();
        $this->withHeader('asaas-access-token', str_repeat('synthetic', 5))->postJson('/api/v1/billing/webhooks/asaas', [])->assertStatus(503);
        $this->assertDatabaseCount('webhook_events', 0);
        Http::assertNothingSent();
    }

    public function test_verified_payment_activates_once_and_duplicate_event_does_not_reapply(): void
    {
        [, $org] = $this->tenant();
        $this->linkProvider($org);
        $this->fakePayment('CONFIRMED');
        $this->webhook('evt_synthetic_paid')->assertOk()->assertJsonPath('data.duplicate', false);
        $periodEnd = DB::table('subscriptions')->where('organization_id', $org)->value('current_period_end');
        $this->webhook('evt_synthetic_paid')->assertOk()->assertJsonPath('data.duplicate', true);
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'active', 'current_period_end' => $periodEnd]);
        $this->assertDatabaseCount('invoices', 1);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('webhook_events', 1);
        Http::assertSentCount(1);
    }

    public function test_out_of_order_paid_event_cannot_reactivate_refunded_payment(): void
    {
        [, $org] = $this->tenant();
        $this->linkProvider($org);
        $this->fakePayment('RECEIVED');
        $this->webhook('evt_synthetic_received')->assertOk();
        $this->fakePayment('REFUNDED');
        $this->webhook('evt_synthetic_refund', 'PAYMENT_REFUNDED')->assertOk();
        $this->webhook('evt_synthetic_delayed_paid', 'PAYMENT_CONFIRMED')->assertOk();
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'suspended']);
        $this->assertDatabaseHas('payments', ['status' => 'REFUNDED', 'refunded_cents' => 3900]);
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_replay_with_changed_resource_is_rejected_and_mismatched_customer_not_applied(): void
    {
        [, $org] = $this->tenant();
        $this->linkProvider($org);
        $this->fakePayment('RECEIVED');
        $this->webhook('evt_synthetic_same')->assertOk();
        $this->webhook('evt_synthetic_same', 'PAYMENT_REFUNDED')->assertConflict();
        $this->fakePayment('RECEIVED', ['customer' => 'cus_other_tenant']);
        $this->webhook('evt_synthetic_wrong_customer')->assertConflict();
        $this->assertDatabaseHas('webhook_events', ['provider_event_id' => 'evt_synthetic_wrong_customer', 'status' => 'failed']);
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'active']);
    }

    public function test_renewal_failure_grace_suspension_and_reactivation_follow_authoritative_payment(): void
    {
        [, $org] = $this->tenant();
        $this->linkProvider($org);
        $this->fakePayment('RECEIVED');
        $this->webhook('evt_synthetic_initial')->assertOk();
        $this->travelTo(now()->setDate(2026, 11, 16));
        config(['billing.grace_days' => 3]);
        $this->fakePayment('OVERDUE', ['id' => 'pay_renewal', 'dueDate' => '2026-11-15']);
        $this->webhook('evt_synthetic_overdue', 'PAYMENT_OVERDUE', 'pay_renewal')->assertOk();
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'past_due']);
        $this->assertTrue(app(SubscriptionService::class)->summary($org)['has_access']);
        $this->travel(4)->days();
        $this->assertFalse(app(SubscriptionService::class)->summary($org)['has_access']);
        $this->webhook('evt_synthetic_overdue_again', 'PAYMENT_OVERDUE', 'pay_renewal')->assertOk();
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'suspended']);
        $this->fakePayment('RECEIVED', ['id' => 'pay_renewal', 'dueDate' => '2026-11-15']);
        $this->webhook('evt_synthetic_renewed', 'PAYMENT_RECEIVED', 'pay_renewal')->assertOk();
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'active']);
        $this->assertDatabaseCount('invoices', 2);
        // Atraso de fatura antiga não suspende um período posterior pago.
        $this->fakePayment('OVERDUE');
        $this->webhook('evt_synthetic_old_overdue', 'PAYMENT_OVERDUE')->assertOk();
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'active']);
    }

    public function test_plan_change_waits_for_next_cycle_payment_and_cancel_preserves_paid_period(): void
    {
        [$user, $org] = $this->tenant();
        $this->linkProvider($org);
        $this->fakePayment('RECEIVED');
        $this->webhook('evt_synthetic_plan_initial')->assertOk();
        Http::fake(['api-sandbox.asaas.com/v3/subscriptions/sub_synthetic' => Http::response(['id' => 'sub_synthetic'], 200)]);
        $this->actingAs($user)->withSession(['organization_id' => $org])->postJson('/api/v1/billing/change-plan', ['plan_code' => 'pro'])->assertOk()->assertJsonPath('data.plan_code', 'starter');
        $this->travelTo(now()->setDate(2026, 11, 15));
        $this->fakePayment('RECEIVED', ['id' => 'pay_new_plan', 'dueDate' => '2026-11-15', 'value' => 69]);
        $this->webhook('evt_synthetic_new_plan', 'PAYMENT_RECEIVED', 'pay_new_plan')->assertOk();
        $this->assertSame('pro', app(SubscriptionService::class)->summary($org)['plan_code']);
        Http::fake(['api-sandbox.asaas.com/v3/subscriptions/sub_synthetic' => Http::response(['deleted' => true], 200)]);
        $this->postJson('/api/v1/billing/cancel', ['at_period_end' => true])->assertOk()->assertJsonPath('data.has_access', true);
        $this->travel(32)->days();
        $this->assertFalse(app(SubscriptionService::class)->summary($org)['has_access']);
    }

    public function test_monthly_quota_is_transactional_and_tenant_timezone_defines_counter(): void
    {
        [, $org] = $this->tenant();
        $service = app(EntitlementService::class);
        DB::table('subscriptions')->where('organization_id', $org)->update(['trial_ends_at' => '2026-12-01 00:00:00+00']);
        $this->travelTo(now()->utc()->setDate(2026, 11, 1)->setTime(1, 0));
        try {
            DB::transaction(function () use ($service, $org): void {
                $service->consume($org, 'appointments');
                throw new \RuntimeException('synthetic rollback');
            });
        } catch (\RuntimeException) {
        }
        $this->assertDatabaseCount('usage_counters', 0);
        $service->consume($org, 'appointments', 100);
        $this->assertDatabaseHas('usage_counters', ['organization_id' => $org, 'period' => '2026-10', 'consumed' => 100]);
        $this->expectException(HttpException::class);
        $service->consume($org, 'appointments');
    }

    public function test_professionals_inventory_and_premium_cannot_exceed_entitlements(): void
    {
        [, $org] = $this->tenant();
        DB::table('professionals')->insert(['id' => (string) Str::uuid(), 'organization_id' => $org, 'name' => 'Profissional sintético', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $service = app(EntitlementService::class);
        try {
            $service->assertCanCreate($org, 'professionals');
            $this->fail('Limite deveria impedir um novo profissional.');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }
        $this->expectException(HttpException::class);
        $service->consume($org, 'premium');
    }

    public function test_catalog_preserves_legacy_plans_and_unlimited_is_distinct_from_missing_entitlement(): void
    {
        $plans = collect(app(BillingCatalog::class)->plans())->keyBy('code');
        $this->assertCount(3, $plans);
        $this->assertSame(3900, $plans['starter']['price_cents']);
        $this->assertSame(1, $plans['starter']['entitlements']['professionals']);
        $this->assertSame(100, $plans['starter']['entitlements']['appointments']);
        $this->assertSame(6900, $plans['pro']['price_cents']);
        $this->assertSame(5, $plans['pro']['entitlements']['professionals']);
        $this->assertNull($plans['pro']['entitlements']['appointments']);
        $this->assertSame(9900, $plans['clinic']['price_cents']);
        $this->assertNull($plans['clinic']['entitlements']['professionals']);
        $this->assertNull($plans['clinic']['entitlements']['appointments']);
        [, $org] = $this->tenant();
        DB::table('subscriptions')->where('organization_id', $org)->update(['plan_version_id' => $plans['clinic']['version_id']]);
        $service = app(EntitlementService::class);
        $service->consume($org, 'appointments', 101);
        $this->assertDatabaseHas('usage_counters', ['organization_id' => $org, 'resource' => 'appointments', 'consumed' => 101]);
        DB::table('plan_entitlements')->where('plan_version_id', $plans['clinic']['version_id'])->where('resource', 'professionals')->delete();
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Recurso não incluído no plano.');
        $service->assertCanCreate($org, 'professionals');
    }

    public function test_billing_history_is_scoped_and_unrelated_tenant_header_is_ignored(): void
    {
        [$ownerA, $orgA] = $this->tenant();
        $this->linkProvider($orgA);
        $this->fakePayment('RECEIVED');
        $this->webhook('evt_synthetic_isolation')->assertOk();
        [$ownerB, $orgB] = $this->tenant();
        $this->actingAs($ownerB)->withSession(['organization_id' => $orgB])->withHeader('X-Organization-Id', $orgA)->getJson('/api/v1/billing/invoices')->assertOk()->assertExactJson(['data' => []]);
        $this->actingAs($ownerA)->withSession(['organization_id' => $orgA])->getJson('/api/v1/billing/invoices')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_periodic_reconciliation_recovers_a_missing_payment_event(): void
    {
        [, $org] = $this->tenant();
        $this->linkProvider($org);
        Http::fake(['api-sandbox.asaas.com/v3/subscriptions/sub_synthetic/payments*' => Http::response(['data' => [['id' => 'pay_synthetic']], 'hasMore' => false], 200)]);
        $this->fakePayment('RECEIVED');
        $result = app(SubscriptionMaintenance::class)->reconcile();
        $this->assertSame(1, $result['payments_checked']);
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'active']);
        $this->assertDatabaseCount('invoices', 1);
    }

    public function test_expiry_changes_persisted_state_and_immediate_cancel_cannot_be_reactivated_by_late_event(): void
    {
        [$owner, $org] = $this->tenant();
        $this->travel(20)->days();
        $this->assertSame(1, app(SubscriptionMaintenance::class)->expire());
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'suspended']);
        $this->travelBack();
        $this->linkProvider($org);
        $this->fakePayment('RECEIVED');
        $this->webhook('evt_synthetic_before_cancel')->assertOk();
        Http::fake(['api-sandbox.asaas.com/v3/subscriptions/sub_synthetic' => Http::response(['deleted' => true], 200)]);
        $this->actingAs($owner)->withSession(['organization_id' => $org])->postJson('/api/v1/billing/cancel', ['at_period_end' => false])->assertOk()->assertJsonPath('data.has_access', false);
        $this->webhook('evt_synthetic_after_cancel')->assertOk();
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $org, 'status' => 'canceled']);
    }

    private function tenant(): array
    {
        $user = User::create(['name' => 'Proprietário sintético', 'email' => 'owner-'.Str::uuid().'@agenda.test', 'password' => 'synthetic-password-only']);
        $org = app(CompleteOnboarding::class)->execute($user, ['name' => 'Organização sintética', 'slug' => 'synthetic-'.Str::uuid(), 'timezone' => 'America/Sao_Paulo']);

        return [$user, $org->id];
    }

    private function enableProvider(): void
    {
        config(['billing.enabled' => true, 'billing.homologated' => true, 'billing.asaas.api_key' => 'synthetic-key-never-real', 'billing.asaas.webhook_token' => str_repeat('synthetic', 5)]);
    }

    private function linkProvider(string $org): void
    {
        $this->enableProvider();
        DB::table('subscriptions')->where('organization_id', $org)->update(['provider' => 'asaas', 'provider_subscription_id' => 'sub_synthetic']);
        DB::table('billing_customers')->insert(['id' => (string) Str::uuid(), 'organization_id' => $org, 'provider' => 'asaas', 'provider_customer_id' => 'cus_synthetic', 'created_at' => now(), 'updated_at' => now()]);
    }

    private function fakePayment(string $status, array $overrides = []): void
    {
        $payment = array_replace(['id' => 'pay_synthetic', 'subscription' => 'sub_synthetic', 'customer' => 'cus_synthetic', 'status' => $status, 'value' => 39, 'dueDate' => '2026-10-15'], $overrides);
        $this->providerPayments[$payment['id']] = $payment;
        Http::fake(['api-sandbox.asaas.com/v3/payments/*' => fn ($request) => Http::response($this->providerPayments[basename(parse_url($request->url(), PHP_URL_PATH))] ?? [], 200)]);
    }

    private function webhook(string $eventId, string $event = 'PAYMENT_RECEIVED', string $paymentId = 'pay_synthetic'): TestResponse
    {
        return $this->withHeader('asaas-access-token', str_repeat('synthetic', 5))->postJson('/api/v1/billing/webhooks/asaas', ['id' => $eventId, 'event' => $event, 'payment' => ['id' => $paymentId, 'subscription' => 'sub_synthetic']]);
    }
}
