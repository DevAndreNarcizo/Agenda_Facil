import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Appointment, currency, errorMessage, localDateTime } from '../core/api';
import { Auth } from '../core/auth';
interface DashboardData {
  appointments_today: number;
  customers: number;
  professionals: number;
  monthly_revenue_cents: number;
  upcoming: Appointment[];
}
@Component({
  imports: [RouterLink],
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Visão do negócio</p>
        <h1>Início</h1>
        <p>Seu dia de atendimento, em um só lugar.</p>
      </div>
      <a class="button" [routerLink]="'/reservar/' + auth.identity()?.organization?.slug"
        >Abrir página de reserva</a
      >
    </header>
    @if (loading()) {
      <p role="status">Carregando seu painel…</p>
    } @else if (error()) {
      <div class="notice error" role="alert">
        {{ error() }} <button (click)="load()">Tentar novamente</button>
      </div>
    } @else if (data(); as stats) {
      <div class="kpi-strip">
        <div>
          <span>Agendamentos hoje</span><strong>{{ stats.appointments_today }}</strong>
        </div>
        <div>
          <span>Clientes</span><strong>{{ stats.customers }}</strong>
        </div>
        <div>
          <span>Profissionais</span><strong>{{ stats.professionals }}</strong>
        </div>
        <div>
          <span>Receita no mês</span><strong>{{ money(stats.monthly_revenue_cents) }}</strong>
        </div>
      </div>
      <section class="panel">
        <div class="section-heading">
          <h2>Próximos agendamentos</h2>
          <a routerLink="/dashboard/calendar">Ver agenda</a>
        </div>
        @if (!stats.upcoming.length) {
          <div class="empty">
            <h3>Sua agenda está pronta para começar</h3>
            <p>Cadastre um serviço e um profissional, depois compartilhe seu link de reserva.</p>
            <a class="button primary" routerLink="/dashboard/services">Cadastrar serviço</a>
          </div>
        } @else {
          <ul class="appointment-list">
            @for (item of stats.upcoming; track item.id) {
              <li>
                <div>
                  <strong>{{ item.customer?.name || 'Atendimento' }}</strong>
                  <p>{{ item.service?.name }} · {{ item.professional?.name }}</p>
                </div>
                <span>{{ date(item.start_time) }}</span>
              </li>
            }
          </ul>
        }
      </section>
    }
  </section>`,
})
export class DashboardPage {
  private readonly api = inject(Api);
  readonly auth = inject(Auth);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly data = signal<DashboardData | null>(null);
  readonly money = currency;
  constructor() {
    void this.load();
  }
  date(value: string): string {
    return localDateTime(value, this.auth.identity()?.organization?.timezone);
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.get<DashboardData>('/dashboard'));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
