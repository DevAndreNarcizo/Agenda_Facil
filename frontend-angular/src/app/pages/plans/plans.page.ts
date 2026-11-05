import { Component, inject, OnInit } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { BillingService } from '../../core/services/billing.service';

/**
 * Catálogo de planos vindo do SERVIDOR (preços não vivem no frontend).
 */
@Component({
  selector: 'af-plans',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './plans.page.html',
})
export class PlansPage implements OnInit {
  readonly billing = inject(BillingService);

  async ngOnInit(): Promise<void> {
    await this.billing.loadPlans();
  }

  formatPrice(cents: number | null): string {
    if (cents === null) {
      return '—';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  }
}
