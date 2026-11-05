<?php

declare(strict_types=1);

namespace Modules\CustomerPortal\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Modules\CustomerPortal\DataObjects\OtpRequestResult;
use Modules\CustomerPortal\DataObjects\PortalSessionResult;
use Modules\CustomerPortal\Exceptions\PortalRateLimitException;
use Modules\CustomerPortal\Models\PortalOtpChallenge;
use Modules\CustomerPortal\Models\PortalOtpRequest;
use Modules\CustomerPortal\Models\PortalSession;
use Modules\Customers\Models\Customer;

/**
 * Autenticação do portal do cliente por OTP (passwordless), preservando as garantias do
 * sistema atual (SPEC-002):
 *  - anti-enumeração: resposta genérica independente de o telefone existir;
 *  - rate-limit por telefone e por IP;
 *  - código com hash + pepper, expiração curta e limite de tentativas;
 *  - sessão OPACA: só o hash do token é persistido; o token é devolvido uma única vez.
 */
final class PortalAuthService
{
    private const int OTP_TTL_MINUTES = 5;

    private const int OTP_MAX_ATTEMPTS = 5;

    private const int SESSION_TTL_HOURS = 8;

    private const int RATE_PER_PHONE = 3;      // por janela

    private const int RATE_PER_IP = 10;        // por janela

    private const int RATE_WINDOW_MINUTES = 15;

    /**
     * Solicita um OTP. Sempre retorna sucesso genérico (anti-enumeração), mas só gera
     * código quando há exatamente um cliente com o telefone informado.
     */
    public function requestOtp(string $organizationId, string $phone, string $ip): OtpRequestResult
    {
        $phoneNormalized = Customer::normalizePhone($phone);
        if ($phoneNormalized === null) {
            return OtpRequestResult::generic();
        }

        $this->enforceRateLimit($organizationId, $phoneNormalized, $ip);

        // Registra o pedido para o rate-limit (independe de o cliente existir).
        PortalOtpRequest::create([
            'organization_id' => $organizationId,
            'phone_hash' => $this->hash($phoneNormalized),
            'ip_hash' => $this->hash($ip),
        ]);

        $customers = Customer::query()
            ->where('organization_id', $organizationId)
            ->where('phone_normalized', $phoneNormalized)
            ->get();

        // Só emite OTP para correspondência única (não vaza existência/ambiguidade).
        if ($customers->count() !== 1) {
            return OtpRequestResult::generic();
        }

        $customer = $customers->first();
        $code = (string) random_int(100000, 999999);

        PortalOtpChallenge::create([
            'organization_id' => $organizationId,
            'customer_id' => $customer->id,
            'phone_normalized' => $phoneNormalized,
            'code_hash' => $this->hash($code),
            'expires_at' => Carbon::now()->addMinutes(self::OTP_TTL_MINUTES),
        ]);

        // Em produção, o código é enviado por WhatsApp (worker de notificações).
        // Aqui devolvemos apenas em ambiente de teste para permitir verificação ponta a ponta.
        return OtpRequestResult::issued(app()->environment('testing', 'local') ? $code : null);
    }

    /**
     * Verifica o OTP e cria uma sessão opaca. Lança em caso de código inválido/expirado.
     */
    public function verifyOtp(string $organizationId, string $phone, string $code): PortalSessionResult
    {
        $phoneNormalized = Customer::normalizePhone($phone);

        return DB::transaction(function () use ($organizationId, $phoneNormalized, $code): PortalSessionResult {
            /** @var PortalOtpChallenge|null $challenge */
            $challenge = PortalOtpChallenge::query()
                ->where('organization_id', $organizationId)
                ->where('phone_normalized', $phoneNormalized)
                ->whereNull('consumed_at')
                ->where('expires_at', '>', Carbon::now())
                ->orderByDesc('created_at')
                ->lockForUpdate()
                ->first();

            if ($challenge === null || $challenge->attempts >= self::OTP_MAX_ATTEMPTS) {
                throw new \RuntimeException('Código inválido ou expirado.');
            }

            if (! hash_equals($challenge->code_hash, $this->hash($code))) {
                $challenge->increment('attempts');
                throw new \RuntimeException('Código inválido ou expirado.');
            }

            $challenge->update(['consumed_at' => Carbon::now()]);

            // Revoga sessões anteriores do cliente e cria uma nova sessão opaca.
            PortalSession::query()
                ->where('customer_id', $challenge->customer_id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => Carbon::now()]);

            $token = bin2hex(random_bytes(32)); // 64 hex
            $expiresAt = Carbon::now()->addHours(self::SESSION_TTL_HOURS);

            PortalSession::create([
                'organization_id' => $organizationId,
                'customer_id' => $challenge->customer_id,
                'token_hash' => $this->hash($token),
                'expires_at' => $expiresAt,
                'last_seen_at' => Carbon::now(),
            ]);

            return new PortalSessionResult($token, $expiresAt->toIso8601String(), (string) $challenge->customer_id);
        });
    }

    /**
     * Resolve a sessão a partir do token opaco (header x-portal-session). Null se inválida.
     */
    public function resolveSession(string $organizationId, ?string $token): ?PortalSession
    {
        if (! is_string($token) || ! preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }

        /** @var PortalSession|null $session */
        $session = PortalSession::query()
            ->where('organization_id', $organizationId)
            ->where('token_hash', $this->hash($token))
            ->first();

        if ($session === null || ! $session->isValid()) {
            return null;
        }

        $session->update(['last_seen_at' => Carbon::now()]);

        return $session;
    }

    private function enforceRateLimit(string $organizationId, string $phoneNormalized, string $ip): void
    {
        $since = Carbon::now()->subMinutes(self::RATE_WINDOW_MINUTES);

        $byPhone = PortalOtpRequest::query()
            ->where('organization_id', $organizationId)
            ->where('phone_hash', $this->hash($phoneNormalized))
            ->where('created_at', '>=', $since)
            ->count();

        $byIp = PortalOtpRequest::query()
            ->where('organization_id', $organizationId)
            ->where('ip_hash', $this->hash($ip))
            ->where('created_at', '>=', $since)
            ->count();

        if ($byPhone >= self::RATE_PER_PHONE || $byIp >= self::RATE_PER_IP) {
            throw new PortalRateLimitException('Muitas solicitações. Tente novamente em alguns minutos.');
        }
    }

    private function hash(string $value): string
    {
        $pepper = (string) Config::get('portal.token_pepper', 'dev-pepper');

        return hash_hmac('sha256', $value, $pepper);
    }
}
