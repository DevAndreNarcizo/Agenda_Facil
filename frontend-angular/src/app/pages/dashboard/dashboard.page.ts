import { Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AgendaService } from '../../core/services/agenda.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { IconComponent } from '../../core/ui/icon.component';
import { APPOINTMENT_STATUS, formatBRL, SUBSCRIPTION_STATUS } from '../../core/ui/helpers';

/**
 * Início: resumo do dia e do mês (agenda de hoje, volume, faturamento) e plano atual.
 */
@Component({
  selector: 'af-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage implements OnInit {
  readonly auth = inject(AuthService);
  readonly billing = inject(BillingService);
  readonly agenda = inject(AgendaService);
  readonly analytics = inject(AnalyticsService);

  readonly statusMeta = APPOINTMENT_STATUS;
  readonly subStatus = SUBSCRIPTION_STATUS;
  readonly formatBRL = formatBRL;

  readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);
  readonly activeToday = computed(() => this.agenda.appointments().filter((a) => a.status !== 'cancelled'));

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.auth.loadMe();
    }
    const day = new Date().toLocaleDateString('sv-SE');
    // Painéis independentes e não fatais: um que falhe não derruba o início.
    await Promise.allSettled([
      this.agenda.loadAppointments(`${day}T00:00:00`, `${day}T23:59:59`),
      this.analytics.load(),
      this.billing.loadSubscription(),
    ]);
  }
}
