import { Component, computed, inject, OnInit } from '@angular/core';
import { AnalyticsService } from '../../core/services/analytics.service';

/**
 * Painel de analytics: KPIs do mês, série diária (barras) e serviços mais agendados.
 */
@Component({
  selector: 'af-analytics',
  standalone: true,
  templateUrl: './analytics.page.html',
})
export class AnalyticsPage implements OnInit {
  readonly analytics = inject(AnalyticsService);

  // Máximo da série para normalizar as barras (evita divisão por zero).
  readonly maxDaily = computed(() => {
    const days = this.analytics.summary()?.by_day ?? [];
    return days.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  });

  async ngOnInit(): Promise<void> {
    await this.analytics.load();
  }

  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  }

  barHeight(count: number): number {
    return Math.round((count / this.maxDaily()) * 100);
  }
}
