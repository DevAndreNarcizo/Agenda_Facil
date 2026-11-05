<?php

declare(strict_types=1);

namespace Modules\Billing\Enums;

/**
 * Status canônico ÚNICO da assinatura. Elimina a inconsistência 'cancelled' vs 'canceled'
 * do sistema legado (AUDIT §5). Toda a aplicação usa estes valores.
 */
enum SubscriptionStatus: string
{
    case Incomplete = 'incomplete';   // criada, aguardando confirmação de pagamento
    case Trialing = 'trialing';       // em período de teste
    case Active = 'active';           // paga e vigente (só por evento autenticado)
    case PastDue = 'past_due';        // cobrança não paga
    case Grace = 'grace';             // período de regularização
    case Suspended = 'suspended';     // suspensa por falta de pagamento
    case Canceled = 'canceled';       // encerrada

    /**
     * Estados em que a organização pode usar operações pagas do produto.
     */
    public function grantsPaidAccess(): bool
    {
        return in_array($this, [self::Trialing, self::Active, self::Grace], true);
    }

    /**
     * Estados "vivos" (contam para o limite de uma assinatura por organização).
     */
    public function isLive(): bool
    {
        return $this !== self::Canceled;
    }

    /**
     * Mapeia status de provedores externos para o status canônico.
     * Aceita tanto 'canceled' (Stripe) quanto 'cancelled' (legado) convergindo para Canceled.
     */
    public static function fromGateway(string $value): self
    {
        return match (strtolower($value)) {
            'trialing' => self::Trialing,
            'active' => self::Active,
            'past_due', 'unpaid' => self::PastDue,
            'canceled', 'cancelled' => self::Canceled,
            'incomplete', 'incomplete_expired' => self::Incomplete,
            'paused' => self::Suspended,
            default => self::Incomplete,
        };
    }
}
