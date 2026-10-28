import { Component, inject, signal } from '@angular/core';
import { Api, currency, errorMessage } from '../core/api';
interface Analytics {
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  revenue_cents: number;
  occupancy_percent: number;
}
@Component({
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Resultados do negócio</p>
        <h1>Analytics</h1>
        <p>Indicadores calculados a partir dos atendimentos registrados.</p>
      </div>
    </header>
    @if (error()) {
      <p role="alert" class="notice error">{{ error() }}</p>
    } @else if (data(); as stats) {
      <div class="kpi-strip">
        <div>
          <span>Agendamentos</span><strong>{{ stats.total_appointments }}</strong>
        </div>
        <div>
          <span>Concluídos</span><strong>{{ stats.completed_appointments }}</strong>
        </div>
        <div>
          <span>Cancelados</span><strong>{{ stats.cancelled_appointments }}</strong>
        </div>
        <div>
          <span>Receita</span><strong>{{ money(stats.revenue_cents) }}</strong>
        </div>
      </div>
      <section class="panel">
        <h2>Ocupação</h2>
        <p class="plan-price">{{ stats.occupancy_percent }}%</p>
        <p class="help">Resultado conforme expediente e período disponíveis no servidor.</p>
      </section>
    } @else {
      <p role="status">Carregando indicadores…</p>
    }
  </section>`,
})
export class AnalyticsPage {
  private readonly api = inject(Api);
  readonly data = signal<Analytics | null>(null);
  readonly error = signal('');
  readonly money = currency;
  constructor() {
    void this.api
      .get<Analytics>('/analytics')
      .then((data) => this.data.set(data))
      .catch((error) => this.error.set(errorMessage(error)));
  }
}
