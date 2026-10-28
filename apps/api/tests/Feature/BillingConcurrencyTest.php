<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Billing\Services\EntitlementService;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

final class BillingConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    public function test_two_real_database_transactions_cannot_consume_last_quota_twice(): void
    {
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('pcntl é necessário para prova de concorrência real.');
        }
        config(['billing.local_fixtures' => true]);
        $user = User::create(['name' => 'Owner concorrência sintética', 'email' => 'concurrency-'.Str::uuid().'@agenda.test', 'password' => 'synthetic-password-only']);
        $org = app(CompleteOnboarding::class)->execute($user, ['name' => 'Concorrência sintética', 'slug' => 'concurrency-'.Str::uuid()]);
        $version = DB::table('subscriptions')->where('organization_id', $org->id)->value('plan_version_id');
        DB::table('plan_entitlements')->where('plan_version_id', $version)->where('resource', 'appointments')->update(['limit_value' => 1]);
        DB::disconnect();
        $children = [];
        for ($index = 0; $index < 2; $index++) {
            $pid = pcntl_fork();
            $this->assertNotSame(-1, $pid, 'Não foi possível criar processo de teste.');
            if ($pid === 0) {
                DB::purge();
                try {
                    DB::transaction(function () use ($org): void {
                        app(EntitlementService::class)->consume($org->id, 'appointments');
                        usleep(200_000);
                    });
                    exit(0);
                } catch (HttpException $exception) {
                    exit($exception->getStatusCode() === 403 ? 3 : 5);
                } catch (\Throwable) {
                    exit(6);
                }
            }
            $children[] = $pid;
        }
        $codes = [];
        foreach ($children as $pid) {
            pcntl_waitpid($pid, $status);
            $codes[] = pcntl_wexitstatus($status);
        }
        sort($codes);
        $this->assertSame([0, 3], $codes, 'Uma transação deve consumir e a outra deve receber 403.');
        DB::purge();
        $this->assertSame(1, (int) DB::table('usage_counters')->where('organization_id', $org->id)->value('consumed'));
    }
}
