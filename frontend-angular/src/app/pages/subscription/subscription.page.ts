import { Component, inject, OnInit, signal } from '@angular/core';
import { BillingService } from '../../core/services/billing.service';

/**
 * Administração da assinatura (owner). Checkout resolvido no servidor.
 */
@Component({
  selector: 'af-subscription',
  standalone: true,
  templateUrl: './subscription.page.html',
})
export class SubscriptionPage implements OnInit {
  readonly billing = inject(BillingService);
  readonly busy = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.billing.loadPlans(), this.billing.loadSubscription()]);
  }

  async subscribe(planCode: string): Promise<void> {
    this.busy.set(planCode);
    try {
      const url = await this.billing.checkout(planCode);
      window.location.assign(url);
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
}
