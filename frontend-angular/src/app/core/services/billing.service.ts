import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Plan, SubscriptionSummary } from '../models';

/**
 * Acesso ao módulo de billing da API. O catálogo de planos é a FONTE do servidor
 * (não há preços no frontend) e o estado da assinatura é lido do backend.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly _plans = signal<Plan[]>([]);
  private readonly _subscription = signal<SubscriptionSummary | null>(null);

  readonly plans = this._plans.asReadonly();
  readonly subscription = this._subscription.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async loadPlans(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ data: Plan[] }>(`${environment.apiBaseUrl}/plans`),
    );
    this._plans.set(res.data);
  }

  async loadSubscription(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ subscription: SubscriptionSummary | null }>(
        `${environment.apiBaseUrl}/subscription`,
      ),
    );
    this._subscription.set(res.subscription);
  }

  async checkout(planCode: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`${environment.apiBaseUrl}/subscription/checkout`, {
        plan_code: planCode,
      }),
    );
    return res.url;
  }
}
