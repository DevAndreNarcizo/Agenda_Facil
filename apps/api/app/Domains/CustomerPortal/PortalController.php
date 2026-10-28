<?php

declare(strict_types=1);

namespace App\Domains\CustomerPortal;

use App\Domains\Audit\Audit;
use App\Domains\Customers\Models\Customer;
use App\Domains\Notifications\Services\OutboxService;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Scheduling\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

final class PortalController
{
    /** Emite link de uso único; a resposta não revela se o email está cadastrado. @author André Narcizo */
    public function requestAccess(Request $request, string $slug): JsonResponse
    {
        $input = $request->validate(['email' => 'required|email:rfc|max:255']);
        $organization = $this->organization($slug);
        abort_if(in_array(config('mail.default'), ['log', 'array'], true) && ! app()->environment('testing'), 503, 'O envio de acesso ao portal está indisponível.');
        $email = strtolower($input['email']);
        $customer = Customer::where('organization_id', $organization->id)->whereRaw('lower(email) = ?', [$email])->orderBy('created_at')->first();
        if ($customer) {
            $token = Str::random(64);
            $id = (string) Str::uuid();
            DB::table('customer_portal_login_tokens')->insert([
                'id' => $id, 'organization_id' => $organization->id, 'customer_id' => $customer->id,
                'email_hash' => hash('sha256', $email),
                'token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes(15), 'created_at' => now(),
            ]);
            try {
                // Fragmentos não são enviados como Referer nem ficam no access log do servidor.
                $url = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/portal/'.rawurlencode($slug).'#token='.$token;
                Mail::to($email)->send(new PortalAccessMail($url));
            } catch (\Throwable) {
                DB::table('customer_portal_login_tokens')->where('id', $id)->delete();
                // Não registrar a exceção do transporte: ela pode conter o link ou destinatário.
            }
        }

        return response()->json(['data' => ['message' => 'Se houver um cadastro com este email, você receberá um link de acesso.']], 202);
    }

    /** Consome token sob lock e cria sessão opaca independente da conta do proprietário. @author André Narcizo */
    public function verify(Request $request, string $slug): JsonResponse
    {
        $input = $request->validate(['token' => 'required|string|size:64']);
        $organization = $this->organization($slug);
        $sessionToken = DB::transaction(function () use ($input, $organization): string {
            $token = DB::table('customer_portal_login_tokens')->where('organization_id', $organization->id)
                ->where('token_hash', hash('sha256', $input['token']))->lockForUpdate()->first();
            abort_unless($token && ! $token->consumed_at && now()->lt($token->expires_at), 401, 'Link inválido ou expirado. Solicite outro acesso.');
            $customer = Customer::where('organization_id', $organization->id)->findOrFail($token->customer_id);
            abort_unless(hash_equals($token->email_hash, hash('sha256', strtolower((string) $customer->email))), 401, 'O cadastro mudou. Solicite outro acesso.');
            DB::table('customer_portal_login_tokens')->where('id', $token->id)->update(['consumed_at' => now()]);
            $value = Str::random(64);
            DB::table('customer_portal_sessions')->insert([
                'id' => (string) Str::uuid(), 'organization_id' => $organization->id, 'customer_id' => $token->customer_id,
                'token_hash' => hash('sha256', $value), 'expires_at' => now()->addHours(2), 'created_at' => now(),
                'email_hash' => $token->email_hash,
            ]);

            return $value;
        }, 3);

        return response()->json(['data' => ['authenticated' => true]])->withCookie(
            Cookie::make('agenda_customer_portal', $sessionToken, 120, $this->cookiePath($slug), null, (bool) config('session.secure'), true, false, 'strict')
        );
    }

    public function appointments(Request $request, string $slug): JsonResponse
    {
        [$organization, $customer] = $this->identity($request, $slug);
        $appointments = Appointment::where('organization_id', $organization->id)->whereIn('customer_id', $this->customerIds($organization, $customer))
            ->with(['service:id,name', 'professional:id,name'])->orderByDesc('start_time')->limit(100)
            ->get(['id', 'service_id', 'professional_id', 'start_time', 'end_time', 'status', 'price_cents']);

        return response()->json(['data' => ['customer' => $customer->only(['name']), 'organization' => $organization->only(['name', 'slug', 'timezone']), 'appointments' => $appointments]]);
    }

    public function book(Request $request, string $slug, BookAppointment $action): JsonResponse
    {
        [$organization, $customer] = $this->identity($request, $slug);
        abort_unless($organization->public_booking_enabled, 403, 'Novas reservas estão indisponíveis.');
        $input = $request->validate([
            'service_id' => 'required|uuid', 'professional_id' => 'required|uuid', 'start_time' => ['required', 'date', 'regex:/T.+(?:Z|[+-]\d{2}:\d{2})$/'],
            'organization_id' => 'prohibited', 'customer_id' => 'prohibited', 'price_cents' => 'prohibited', 'status' => 'prohibited',
        ]);
        $key = $request->header('Idempotency-Key');
        abort_unless(is_string($key) && preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key), 422, 'Informe Idempotency-Key válido.');
        $appointment = $action->execute($organization, [...$input, 'customer_id' => $customer->id], null, $key);

        return response()->json(['data' => $appointment->only(['id', 'start_time', 'end_time', 'status'])], 201);
    }

    public function cancel(Request $request, string $slug, string $id): JsonResponse
    {
        [$organization, $customer] = $this->identity($request, $slug);
        DB::transaction(function () use ($organization, $customer, $id): void {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organization->id]);
            $appointment = Appointment::where('organization_id', $organization->id)->whereIn('customer_id', $this->customerIds($organization, $customer))->lockForUpdate()->findOrFail($id);
            abort_unless(in_array($appointment->status, ['pending', 'confirmed', 'cancelled'], true), 409, 'Agendamento já encerrado.');
            $appointment->update(['status' => 'cancelled']);
            app(OutboxService::class)->synchronize($appointment);
            Audit::record($organization->id, null, 'customer_portal.appointment_cancelled', $appointment->id);
        }, 3);

        return response()->json(['data' => ['status' => 'cancelled']]);
    }

    public function logout(Request $request, string $slug): JsonResponse
    {
        [$organization, $customer] = $this->identity($request, $slug);
        DB::table('customer_portal_sessions')->where('organization_id', $organization->id)->where('customer_id', $customer->id)
            ->where('token_hash', hash('sha256', (string) $request->cookie('agenda_customer_portal')))->update(['revoked_at' => now()]);

        return response()->json(['data' => null])->withCookie(Cookie::forget('agenda_customer_portal', $this->cookiePath($slug)));
    }

    /** Resolve customer e tenant exclusivamente da sessão opaca e do slug público. @author André Narcizo */
    private function identity(Request $request, string $slug): array
    {
        $organization = $this->organization($slug);
        $value = $request->cookie('agenda_customer_portal');
        abort_unless(is_string($value) && strlen($value) === 64, 401, 'Acesse o portal para continuar.');
        $session = DB::table('customer_portal_sessions')->where('organization_id', $organization->id)
            ->where('token_hash', hash('sha256', $value))->whereNull('revoked_at')->where('expires_at', '>', now())->first();
        abort_unless($session, 401, 'Seu acesso expirou. Solicite outro link.');
        $customer = Customer::where('organization_id', $organization->id)->findOrFail($session->customer_id);
        abort_unless(hash_equals($session->email_hash, hash('sha256', strtolower((string) $customer->email))), 401, 'O cadastro mudou. Solicite outro acesso.');

        return [$organization, $customer];
    }

    private function organization(string $slug): Organization
    {
        return Organization::where('slug', $slug)->firstOrFail();
    }

    /** Um email comprovado acessa reservas desse mesmo email no mesmo tenant, inclusive cadastros públicos repetidos. @author André Narcizo */
    private function customerIds(Organization $organization, Customer $customer): array
    {
        return Customer::where('organization_id', $organization->id)->whereRaw('lower(email) = ?', [strtolower((string) $customer->email)])->pluck('id')->all();
    }

    private function cookiePath(string $slug): string
    {
        return '/api/v1/public/'.rawurlencode($slug).'/portal';
    }
}
