<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Billing\Contracts\BillingProvider;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

final class BillingMaintenanceCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['billing.enabled' => false, 'billing.homologated' => false, 'billing.local_fixtures' => true]);
        Http::preventStrayRequests();
    }

    public function test_expiration_command_is_local_persistent_and_idempotent(): void
    {
        $organization = app(CompleteOnboarding::class)->execute(User::factory()->create(), ['name' => 'Comando sintético', 'slug' => 'command-synthetic']);
        DB::table('subscriptions')->where('organization_id', $organization->id)->update(['trial_ends_at' => now()->subMinute()]);

        $this->artisan('billing:expire')->expectsOutput('Assinaturas expiradas: 1')->assertExitCode(0);
        $this->assertDatabaseHas('subscriptions', ['organization_id' => $organization->id, 'status' => 'suspended']);
        $this->artisan('billing:expire')->expectsOutput('Assinaturas expiradas: 0')->assertExitCode(0);
        $this->assertSame(1, DB::table('subscription_audit_logs')->where('organization_id', $organization->id)->where('action', 'subscription.expired')->count());
        Http::assertNothingSent();
    }

    public function test_reconciliation_requires_both_enablement_and_homologation_without_network(): void
    {
        $provider = Mockery::mock(BillingProvider::class);
        $provider->shouldNotReceive('assertAvailable');
        $provider->shouldNotReceive('payments');
        $this->app->instance(BillingProvider::class, $provider);

        $this->artisan('billing:reconcile')->expectsOutputToContain('Reconciliação desabilitada.')->assertExitCode(1);
        config(['billing.enabled' => true, 'billing.homologated' => false]);
        $this->artisan('billing:reconcile')->expectsOutputToContain('Reconciliação desabilitada.')->assertExitCode(1);
        Http::assertNothingSent();
    }

    public function test_reconciliation_uses_configured_provider_and_reports_only_counters(): void
    {
        config(['billing.enabled' => true, 'billing.homologated' => true]);
        $provider = Mockery::mock(BillingProvider::class);
        $provider->shouldReceive('assertAvailable')->once();
        $provider->shouldReceive('name')->once()->andReturn('asaas');
        $provider->shouldNotReceive('checkout');
        $provider->shouldNotReceive('payments');
        $this->app->instance(BillingProvider::class, $provider);

        $this->artisan('billing:reconcile')->expectsOutput('Cobranças verificadas: 0')->expectsOutput('Assinaturas expiradas: 0')->assertExitCode(0);
        Http::assertNothingSent();
    }

    public function test_reconciliation_failure_does_not_print_provider_exception_details(): void
    {
        config(['billing.enabled' => true, 'billing.homologated' => true]);
        $provider = Mockery::mock(BillingProvider::class);
        $provider->shouldReceive('assertAvailable')->once()->andThrow(new \RuntimeException('synthetic-private-provider-detail'));
        $this->app->instance(BillingProvider::class, $provider);

        $this->artisan('billing:reconcile')
            ->expectsOutput('Reconciliação não concluída. Verifique a configuração homologada e a disponibilidade do provedor; depois repita o comando.')
            ->doesntExpectOutputToContain('synthetic-private-provider-detail')->assertExitCode(1);
        Http::assertNothingSent();
    }

    public function test_scheduler_reconciliation_filter_is_closed_until_homologated(): void
    {
        $events = collect(app(Schedule::class)->events());
        $reconciliation = $events->first(fn ($event): bool => str_contains((string) $event->command, 'billing:reconcile'));
        $expiration = $events->first(fn ($event): bool => str_contains((string) $event->command, 'billing:expire'));
        $this->assertNotNull($reconciliation);
        $this->assertNotNull($expiration);
        $this->assertTrue($reconciliation->withoutOverlapping);
        $this->assertTrue($expiration->withoutOverlapping);
        $this->assertSame('UTC', $reconciliation->timezone);
        $this->assertFalse($reconciliation->filtersPass($this->app));
        config(['billing.enabled' => true, 'billing.homologated' => true]);
        $this->assertTrue($reconciliation->filtersPass($this->app));
        Http::assertNothingSent();
    }
}
