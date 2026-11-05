import { Component, inject, OnInit, signal } from '@angular/core';
import { BillingService } from '../../core/services/billing.service';

/**
 * Administração da assinatura (owner): plano atual, uso de cotas, checkout/troca/cancelamento.
 */
@Component({
  selector: 'af-subscription',
  standalone: true,
  templateUrl: './subscription.page.html',
})
export class SubscriptionPage implements OnInit {
  readonly billing = inject(BillingService);
  readonly busy = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.billing.loadPlans(), this.billing.loadSubscription()]);
  }

  async subscribe(planCode: string): Promise<void> {
    this.busy.set(planCode);
    this.message.set(null);
    try {
      const current = this.billing.subscription();
      // Com assinatura viva, troca de plano; senão inicia checkout.
      if (current && current.status !== 'canceled') {
        await this.billing.changePlan(planCode);
        this.message.set('Plano atualizado.');
      } else {
        const url = await this.billing.checkout(planCode);
        window.location.assign(url);
      }
    } finally {
      this.busy.set(null);
    }
  }

  async cancel(atPeriodEnd: boolean): Promise<void> {
    this.busy.set('cancel');
    try {
      await this.billing.cancel(atPeriodEnd);
      this.message.set(atPeriodEnd ? 'Cancelamento agendado para o fim do período.' : 'Assinatura cancelada.');
    } finally {
      this.busy.set(null);
    }
  }

  formatPrice(cents: number | null): string {
    if (cents === null) {
      return '—';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  }

  usagePercent(): number | null {
    const u = this.billing.usage();
    if (!u || u.monthly_appointments_limit === null) {
      return null;
    }
    return Math.min(100, Math.round((u.monthly_appointments_used / u.monthly_appointments_limit) * 100));
  }
}
