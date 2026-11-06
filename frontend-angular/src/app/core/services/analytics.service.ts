import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AnalyticsSummary } from '../models';

/**
 * Métricas do painel (resumo do período). Escopo de tenant via interceptor (X-Organization-Id).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly _summary = signal<AnalyticsSummary | null>(null);
  readonly summary = this._summary.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async load(from?: string, to?: string): Promise<void> {
    const params = new URLSearchParams();
    if (from) {
      params.set('from', from);
    }
    if (to) {
      params.set('to', to);
    }
    const qs = params.toString();
    const url = `${environment.apiBaseUrl}/analytics/summary${qs ? `?${qs}` : ''}`;
    const res = await firstValueFrom(this.http.get<{ data: AnalyticsSummary }>(url));
    this._summary.set(res.data);
  }
}
