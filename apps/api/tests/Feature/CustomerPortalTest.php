<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\CustomerPortal\PortalAccessMail;
use App\Domains\Customers\Models\Customer;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Services\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CustomerPortalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-11-02T10:00:00-03:00'));
        Mail::fake();
        $this->withCredentials();
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        parent::tearDown();
    }

    private function fixture(string $slug, string $email): array
    {
        $organization = app(CompleteOnboarding::class)->execute(User::factory()->create(), ['name' => 'Organização sintética', 'slug' => $slug, 'timezone' => 'America/Sao_Paulo']);
        $service = Service::forceCreate(['organization_id' => $organization->id, 'name' => 'Serviço sintético', 'duration_minutes' => 30, 'price_cents' => 5000]);
        $professional = Professional::forceCreate(['organization_id' => $organization->id, 'name' => 'Profissional sintético']);
        $customer = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Cliente sintético', 'email' => $email]);
        $input = ['service_id' => $service->id, 'professional_id' => $professional->id, 'customer_id' => $customer->id, 'start_time' => '2026-11-03T12:00:00+00:00'];
        $appointment = app(BookAppointment::class)->execute($organization, $input);

        return [$organization, $customer, $appointment, $input];
    }

    private function accessToken(string $slug, string $email): string
    {
        $this->postJson('/api/v1/public/'.$slug.'/portal/request', ['email' => $email])->assertAccepted()->assertJsonMissingPath('data.token');
        $mail = Mail::sent(PortalAccessMail::class)->last();
        $this->assertNotNull($mail);
        parse_str((string) parse_url($mail->accessUrl, PHP_URL_FRAGMENT), $parts);

        return $parts['token'];
    }

    private function login(string $slug, string $email): string
    {
        $response = $this->postJson('/api/v1/public/'.$slug.'/portal/verify', ['token' => $this->accessToken($slug, $email)])->assertOk();
        $cookie = $response->getCookie('agenda_customer_portal');
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('strict', $cookie->getSameSite());
        $this->assertSame('/api/v1/public/'.$slug.'/portal', $cookie->getPath());

        return $cookie->getValue();
    }

    public function test_access_request_is_generic_and_persists_only_hash_and_single_use_token(): void
    {
        $this->fixture('alpha', 'cliente@example.test');
        $unknown = $this->postJson('/api/v1/public/alpha/portal/request', ['email' => 'ausente@example.test'])->assertAccepted()->json();
        Mail::assertNothingSent();
        $token = $this->accessToken('alpha', 'cliente@example.test');
        $this->assertSame($unknown, $this->postJson('/api/v1/public/alpha/portal/request', ['email' => 'ausente2@example.test'])->assertAccepted()->json());
        $this->assertDatabaseHas('customer_portal_login_tokens', ['token_hash' => hash('sha256', $token)]);
        $this->assertStringNotContainsString($token, json_encode(DB::table('customer_portal_login_tokens')->get(), JSON_THROW_ON_ERROR));
        $this->postJson('/api/v1/public/alpha/portal/verify', ['token' => $token])->assertOk();
        $this->postJson('/api/v1/public/alpha/portal/verify', ['token' => $token])->assertUnauthorized();
    }

    public function test_portal_is_scoped_to_verified_email_and_tenant_and_revokes_logout(): void
    {
        [, , $alpha] = $this->fixture('alpha', 'cliente@example.test');
        [, , $beta] = $this->fixture('beta', 'cliente@example.test');
        $cookie = $this->login('alpha', 'cliente@example.test');
        $this->withCookie('agenda_customer_portal', $cookie);
        $this->getJson('/api/v1/public/alpha/portal/appointments')->assertOk()->assertJsonCount(1, 'data.appointments')->assertJsonPath('data.appointments.0.id', $alpha->id)->assertJsonMissingPath('data.appointments.0.customer.email');
        $this->getJson('/api/v1/public/beta/portal/appointments')->assertUnauthorized();
        $this->postJson('/api/v1/public/alpha/portal/appointments/'.$beta->id.'/cancel')->assertNotFound();
        $this->postJson('/api/v1/public/alpha/portal/appointments/'.$alpha->id.'/cancel')->assertOk();
        $this->postJson('/api/v1/public/alpha/portal/logout')->assertOk();
        $this->getJson('/api/v1/public/alpha/portal/appointments')->assertUnauthorized();
    }

    public function test_expired_token_and_changed_email_never_grant_access(): void
    {
        [, $customer] = $this->fixture('alpha', 'cliente@example.test');
        $token = $this->accessToken('alpha', 'cliente@example.test');
        $this->travel(16)->minutes();
        $this->postJson('/api/v1/public/alpha/portal/verify', ['token' => $token])->assertUnauthorized();
        $token = $this->accessToken('alpha', 'cliente@example.test');
        $customer->update(['email' => 'outro@example.test']);
        $this->postJson('/api/v1/public/alpha/portal/verify', ['token' => $token])->assertUnauthorized();
    }

    public function test_repeated_public_customer_email_is_visible_without_exposing_other_emails(): void
    {
        [$organization, $customer, , $input] = $this->fixture('alpha', 'cliente@example.test');
        $duplicate = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Mesmo contato sintético', 'email' => 'CLIENTE@example.test']);
        app(BookAppointment::class)->execute($organization, [...$input, 'customer_id' => $duplicate->id, 'start_time' => '2026-11-03T13:00:00+00:00']);
        $other = Customer::forceCreate(['organization_id' => $organization->id, 'name' => 'Outro contato', 'email' => 'diferente@example.test']);
        $third = app(BookAppointment::class)->execute($organization, [...$input, 'customer_id' => $other->id, 'start_time' => '2026-11-03T14:00:00+00:00']);
        $this->withCookie('agenda_customer_portal', $this->login('alpha', 'cliente@example.test'));
        $this->getJson('/api/v1/public/alpha/portal/appointments')->assertOk()->assertJsonCount(2, 'data.appointments');
        $this->postJson('/api/v1/public/alpha/portal/appointments/'.$third->id.'/cancel')->assertNotFound();
        $customer->update(['email' => 'mudou@example.test']);
        $this->getJson('/api/v1/public/alpha/portal/appointments')->assertUnauthorized();
    }

    public function test_portal_booking_uses_shared_overlap_rules_and_never_accepts_customer_or_price(): void
    {
        [$organization, $customer, , $input] = $this->fixture('alpha', 'cliente@example.test');
        $this->withCookie('agenda_customer_portal', $this->login('alpha', 'cliente@example.test'))->withHeader('Idempotency-Key', 'portal-booking-synthetic-123');
        $this->postJson('/api/v1/public/alpha/portal/bookings', $input)->assertUnprocessable()->assertJsonValidationErrors('customer_id');
        unset($input['customer_id']);
        $this->postJson('/api/v1/public/alpha/portal/bookings', $input)->assertConflict();
        $response = $this->postJson('/api/v1/public/alpha/portal/bookings', [...$input, 'start_time' => '2026-11-03T13:00:00+00:00'])->assertCreated();
        $this->assertDatabaseHas('appointments', ['id' => $response->json('data.id'), 'customer_id' => $customer->id, 'organization_id' => $organization->id, 'price_cents' => 5000]);
    }
}
