import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../core/services/billing.service';
import { IconComponent } from '../../core/ui/icon.component';
import { formatBRL, planFeatures } from '../../core/ui/helpers';

/**
 * Catálogo de planos vindo do SERVIDOR (preços não vivem no frontend). Página pública.
 */
@Component({
  selector: 'af-plans',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './plans.page.html',
})
export class PlansPage implements OnInit {
  readonly billing = inject(BillingService);
  readonly features = planFeatures;
  readonly formatPrice = formatBRL;

  async ngOnInit(): Promise<void> {
    await this.billing.loadPlans();
  }
}
