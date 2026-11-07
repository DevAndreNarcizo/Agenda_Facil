import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Plan, SubscriptionSummary, SubscriptionUsage } from '../models';

/**
 * Acesso ao módulo de billing da API. O catálogo de planos é a FONTE do servidor
 * (não há preços no frontend) e o estado da assinatura/uso é lido do backend.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly _plans = signal<Plan[]>([]);
  private readonly _subscription = signal<SubscriptionSummary | null>(null);
  private readonly _usage = signal<SubscriptionUsage | null>(null);

  readonly plans = this._plans.asReadonly();
  readonly subscription = this._subscription.asReadonly();
  readonly usage = this._usage.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async loadPlans(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ data: Plan[] }>(`${environment.apiBaseUrl}/plans`),
    );
    this._plans.set(res.data);
  }

  async loadSubscription(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ subscription: SubscriptionSummary | null; usage: SubscriptionUsage | null }>(
        `${environment.apiBaseUrl}/subscription`,
      ),
    );
    this._subscription.set(res.subscription);
    this._usage.set(res.usage);
  }

  async checkout(planCode: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`${environment.apiBaseUrl}/subscription/checkout`, {
        plan_code: planCode,
      }),
    );
    return res.url;
  }

  async changePlan(planCode: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/subscription/change-plan`, { plan_code: planCode }),
    );
    await this.loadSubscription();
  }

  async cancel(atPeriodEnd: boolean): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/subscription/cancel`, { at_period_end: atPeriodEnd }),
    );
    await this.loadSubscription();
  }
}
