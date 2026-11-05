import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';

/**
 * Painel inicial: saúda o usuário, mostra organização ativa e resumo da assinatura.
 */
@Component({
  selector: 'af-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage implements OnInit {
  readonly auth = inject(AuthService);
  readonly billing = inject(BillingService);

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.auth.loadMe();
    }
    try {
      await this.billing.loadSubscription();
    } catch {
      // resumo de assinatura é opcional no painel inicial
    }
  }
}
