import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
import { Api, Appointment, errorMessage, localDateTime } from '../core/api';
interface PortalData {
  customer: { name: string };
  organization: { name: string; slug: string; timezone: string };
  appointments: Appointment[];
}
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<main id="conteudo" tabindex="-1" class="public-page">
    <header class="public-header">
      <a routerLink="/" class="brand">Agenda<span>Fácil</span></a>
      <p class="eyebrow">Portal do cliente</p>
      <h1>Seus atendimentos</h1>
      <p>Consulte e acompanhe suas reservas neste estabelecimento.</p>
    </header>
    @if (error()) {
      <p class="notice error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="notice success" role="status">{{ message() }}</p>
    }
    @if (loading()) {
      <p role="status">Verificando seu acesso…</p>
    } @else if (data(); as portal) {
      <section class="panel">
        <div class="section-heading">
          <h2>Olá, {{ portal.customer.name }}</h2>
          <button (click)="logout()">Sair</button>
        </div>
        <a class="button primary" [routerLink]="'/reservar/' + slug">Nova reserva</a>
        @if (!portal.appointments.length) {
          <p class="empty">Você ainda não possui agendamentos.</p>
        } @else {
          <ul class="appointment-list">
            @for (item of portal.appointments; track item.id) {
              <li>
                <div>
                  <strong>{{ item.service?.name || 'Atendimento' }}</strong>
                  <p>{{ item.professional?.name }} · {{ date(item.start_time) }}</p>
                  <span class="tag">{{ labels[item.status] || item.status }}</span>
                </div>
                @if (item.status === 'pending' || item.status === 'confirmed') {
                  <button
                    class="danger-quiet"
                    [disabled]="busy()"
                    (click)="requestCancellation(item, cancelDialog)"
                  >
                    Cancelar reserva
                  </button>
                }
              </li>
            }
          </ul>
        }
      </section>
    } @else {
      <section class="panel public-card">
        <h2>Acesse seu portal</h2>
        <p>
          Informe o e-mail usado na reserva. Se houver atendimentos vinculados, você receberá um
          link de acesso.
        </p>
        <form [formGroup]="form" (ngSubmit)="request()">
          <label for="portal-email">E-mail</label
          ><input
            id="portal-email"
            type="email"
            formControlName="email"
            autocomplete="email"
            required
          /><button class="primary" [disabled]="busy()">
            {{ busy() ? 'Enviando…' : 'Receber link de acesso' }}
          </button>
        </form>
        <p class="help">
          O link expira e só pode ser usado uma vez. Nunca compartilhe seu link de acesso.
        </p>
      </section>
    }
    <dialog #cancelDialog class="confirm-dialog" aria-labelledby="portal-cancel-title">
      <h2 id="portal-cancel-title">Cancelar esta reserva?</h2>
      <p>O horário será liberado para outro cliente.</p>
      <div class="row-actions">
        <button autofocus (click)="cancelDialog.close()">Manter reserva</button
        ><button class="danger" [disabled]="busy()" (click)="cancel(cancelDialog)">
          Confirmar cancelamento
        </button>
      </div>
    </dialog>
  </main>`,
})
export class PortalPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  slug = '';
  private generation = 0;
  get path(): string {
    return `/public/${encodeURIComponent(this.slug)}/portal`;
  }
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly data = signal<PortalData | null>(null);
  readonly selected = signal<Appointment | null>(null);
  readonly labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu',
  };
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  constructor() {
    combineLatest([this.route.paramMap, this.route.fragment])
      .pipe(
        map(([params, fragment]) => ({
          slug: params.get('slug') ?? '',
          token: new URLSearchParams(fragment ?? '').get('token'),
        })),
        distinctUntilChanged(
          (previous, next) => previous.slug === next.slug && previous.token === next.token,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ slug, token }) => {
        if (this.slug !== slug) {
          this.slug = slug;
          this.form.reset();
          this.data.set(null);
          this.message.set('');
        }
        if (token) history.replaceState(null, '', location.pathname + location.search);
        void this.initialize(token);
      });
  }

  date(value: string): string {
    return localDateTime(value, this.data()?.organization.timezone ?? 'America/Sao_Paulo');
  }
  async initialize(token: string | null): Promise<void> {
    const generation = ++this.generation;
    const path = this.path;
    this.loading.set(true);
    this.error.set('');
    try {
      if (token) {
        await this.api.csrf();
        if (generation !== this.generation) return;
        await this.api.post(`${path}/verify`, { token });
      }
      const data = await this.api.get<PortalData>(`${path}/appointments`);
      if (generation === this.generation) this.data.set(data);
    } catch (error) {
      if (
        generation === this.generation &&
        (token ||
          !(error && typeof error === 'object' && 'status' in error && error.status === 401))
      )
        this.error.set(errorMessage(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async request(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Informe um e-mail válido.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.csrf();
      await this.api.post(`${this.path}/request`, this.form.getRawValue());
      this.message.set(
        'Se houver atendimentos vinculados a este e-mail, você receberá um link de acesso.',
      );
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  requestCancellation(item: Appointment, dialog: HTMLDialogElement): void {
    this.selected.set(item);
    dialog.showModal();
  }
  async cancel(dialog: HTMLDialogElement): Promise<void> {
    const id = this.selected()?.id;
    if (!id) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post(`${this.path}/appointments/${id}/cancel`);
      dialog.close();
      await this.initialize(null);
      this.message.set('Reserva cancelada.');
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async logout(): Promise<void> {
    try {
      await this.api.post(`${this.path}/logout`);
      this.data.set(null);
      this.message.set('Acesso encerrado.');
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
