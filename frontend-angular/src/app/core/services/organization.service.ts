import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { OrganizationState } from '../models';

export interface OnboardingPayload {
  business_name: string;
  specialty?: string;
  segment?: string;
  schedule: { day_of_week: number; start: string; end: string; active: boolean }[];
  first_service: { name: string; duration_minutes: number; price_cents?: number };
}

/**
 * Estado da organização (onboarding + horários). Consome a API Laravel.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly _state = signal<OrganizationState | null>(null);
  readonly state = this._state.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async load(): Promise<OrganizationState> {
    const res = await firstValueFrom(
      this.http.get<{ data: OrganizationState }>(`${environment.apiBaseUrl}/organization`),
    );
    this._state.set(res.data);
    return res.data;
  }

  async completeOnboarding(payload: OnboardingPayload): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/organization/onboarding`, payload),
    );
    await this.load();
  }
}
