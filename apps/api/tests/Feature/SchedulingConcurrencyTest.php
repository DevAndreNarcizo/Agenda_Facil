<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Customers\Models\Customer;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

final class SchedulingConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    public function test_two_independent_transactions_cannot_reserve_the_same_interval(): void
    {
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('pcntl é necessário para testar concorrência real.');
        }
        $this->travelTo(CarbonImmutable::parse('2026-11-02T10:00:00-03:00'));
        try {
            $organization = app(CompleteOnboarding::class)->execute(User::factory()->create(), ['name' => 'Concorrência sintética', 'slug' => 'concurrent-booking']);
            $service = Service::forceCreate(['organization_id' => $organization->id, 'name' => 'Serviço sintético', 'duration_minutes' => 60, 'price_cents' => 9000]);
            $professional = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Profissional sintético']);
            $customer = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Cliente sintético']);
            $input = ['service_id' => $service->id, 'professional_id' => $professional->id, 'customer_id' => $customer->id, 'start_time' => '2026-11-03T12:00:00+00:00'];
            DB::disconnect();
            $children = [];
            for ($index = 0; $index < 2; $index++) {
                $pid = pcntl_fork();
                $this->assertNotSame(-1, $pid, 'Não foi possível criar o processo concorrente.');
                if ($pid === 0) {
                    DB::purge();
                    try {
                        app(BookAppointment::class)->execute($organization, $input);
                        exit(0);
                    } catch (HttpException $exception) {
                        exit($exception->getStatusCode() === 409 ? 3 : 5);
                    } catch (\Throwable) {
                        exit(6);
                    }
                }
                $children[] = $pid;
            }
            $codes = [];
            foreach ($children as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertTrue(pcntl_wifexited($status), 'Processo concorrente terminou inesperadamente.');
                $codes[] = pcntl_wexitstatus($status);
            }
            sort($codes);
            $this->assertSame([0, 3], $codes, 'Uma reserva deve ser aceita e a outra recusada com 409.');
            DB::purge();
            $this->assertSame(1, DB::table('appointments')->where('organization_id', $organization->id)->count());
            $this->assertSame(1, (int) DB::table('usage_counters')->where('organization_id', $organization->id)->where('resource', 'appointments')->value('consumed'));
        } finally {
            $this->travelBack();
        }
    }
}
