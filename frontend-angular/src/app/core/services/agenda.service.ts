import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Appointment, AppointmentStatus, Professional, Service } from '../models';

/**
 * Agenda operacional: serviços, profissionais e agendamentos. Todas as mutações passam
 * pela API (o servidor é a autoridade: anti-overlap e cotas no backend).
 */
@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly _appointments = signal<Appointment[]>([]);
  private readonly _services = signal<Service[]>([]);
  private readonly _professionals = signal<Professional[]>([]);

  readonly appointments = this._appointments.asReadonly();
  readonly services = this._services.asReadonly();
  readonly professionals = this._professionals.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async loadServices(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ data: Service[] }>(`${environment.apiBaseUrl}/services`),
    );
    this._services.set(res.data);
  }

  async loadProfessionals(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ data: Professional[] }>(`${environment.apiBaseUrl}/professionals`),
    );
    this._professionals.set(res.data);
  }

  async loadAppointments(from: string, to: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ data: Appointment[] }>(
        `${environment.apiBaseUrl}/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    );
    this._appointments.set(res.data);
  }

  async createAppointment(input: {
    service_id?: string;
    professional_id?: string;
    customer_id?: string;
    start_time: string;
    end_time: string;
  }): Promise<Appointment> {
    const res = await firstValueFrom(
      this.http.post<{ data: Appointment }>(`${environment.apiBaseUrl}/appointments`, input),
    );
    return res.data;
  }

  async updateStatus(appointmentId: string, status: AppointmentStatus): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/appointments/${appointmentId}/status`, { status }),
    );
  }

  async createService(input: {
    name: string;
    duration_minutes: number;
    price_cents?: number;
    category?: string;
  }): Promise<Service> {
    const res = await firstValueFrom(
      this.http.post<{ data: Service }>(`${environment.apiBaseUrl}/services`, input),
    );
    await this.loadServices();
    return res.data;
  }

  async createProfessional(input: { name: string }): Promise<Professional> {
    const res = await firstValueFrom(
      this.http.post<{ data: Professional }>(`${environment.apiBaseUrl}/professionals`, input),
    );
    await this.loadProfessionals();
    return res.data;
  }
}
