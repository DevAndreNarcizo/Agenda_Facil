import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, Resource, currency, errorMessage, localDateTime } from '../core/api';
interface PublicContext {
  organization: {
    name: string;
    slug: string;
    timezone: string;
    primary_color: string | null;
    logo_url?: string | null;
  };
  services: Resource[];
  professionals: Resource[];
}
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<main
    id="conteudo"
    tabindex="-1"
    class="public-page"
    [style.--af-accent]="brandColor()"
    [style.--af-action]="brandColor()"
    [style.--af-action-ink]="brandInk()"
  >
    @if (loading()) {
      <p role="status">Carregando reserva…</p>
    } @else if (context(); as data) {
      <header class="public-header">
        <a routerLink="/" class="brand">Agenda<span>Fácil</span></a>
        @if (data.organization.logo_url) {
          <img
            [src]="data.organization.logo_url"
            width="96"
            height="96"
            style="object-fit:contain;max-width:100%;"
            [alt]="'Logo de ' + data.organization.name"
          />
        }
        <p class="eyebrow">Reserva online</p>
        <h1>{{ data.organization.name }}</h1>
        <p>Escolha um serviço e um horário disponível.</p>
        <a [routerLink]="'/portal/' + slug">Já tem uma reserva? Acesse seu portal</a>
      </header>
      <section class="panel public-card">
        @if (confirmed()) {
          <div class="empty" role="status">
            <span class="material-symbols-outlined success-icon" aria-hidden="true"
              >check_circle</span
            >
            <h2>Reserva solicitada</h2>
            <p>Seu atendimento foi registrado para {{ date(confirmed()) }}.</p>
            <p>
              Você pode cancelar esta reserva agora. Depois de sair desta página, acesse o portal
              pelo e-mail informado ou fale com o estabelecimento.
            </p>
            @if (error()) {
              <p role="alert" class="notice error">{{ error() }}</p>
            }
            @if (cancellable()) {
              <button class="danger-quiet" (click)="cancelDialog.showModal()">
                Cancelar esta reserva
              </button>
            }
            @if (cancelled()) {
              <p class="notice success">Reserva cancelada com sucesso.</p>
            }
            <button class="primary" (click)="newBooking()">Fazer outra reserva</button>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="book()">
            <label for="public-service">Serviço</label
            ><select id="public-service" formControlName="service_id" (change)="clearSlots()">
              <option value="">Selecione o serviço</option>
              @for (item of data.services; track item.id) {
                <option [value]="item.id">
                  {{ item.name }} · {{ item.duration_minutes }} min ·
                  {{ money(item.price_cents || 0) }}
                </option>
              }</select
            ><label for="public-professional">Profissional</label
            ><select
              id="public-professional"
              formControlName="professional_id"
              (change)="clearSlots()"
            >
              <option value="">Selecione o profissional</option>
              @for (item of data.professionals; track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }</select
            ><label for="public-date">Data</label
            ><input
              id="public-date"
              type="date"
              formControlName="date"
              [min]="minimumDate()"
              (change)="clearSlots()"
            /><button type="button" (click)="loadSlots()" [disabled]="slotLoading()">
              {{ slotLoading() ? 'Consultando…' : 'Consultar horários' }}
            </button>
            @if (searched()) {
              <fieldset class="slot-fieldset">
                <legend>Horários em {{ data.organization.timezone }}</legend>
                @if (!slots().length) {
                  <p class="help">Não há horários disponíveis nesta data. Escolha outro dia.</p>
                }
                <div class="slots">
                  @for (slot of slots(); track slot) {
                    <label class="slot" [class.selected]="form.controls.start_time.value === slot"
                      ><input type="radio" formControlName="start_time" [value]="slot" />{{
                        time(slot)
                      }}</label
                    >
                  }
                </div>
              </fieldset>
            }
            <h2>Seus dados</h2>
            <label for="public-name">Nome</label
            ><input id="public-name" formControlName="name" autocomplete="name" /><label
              for="public-phone"
              >Telefone com DDD</label
            ><input id="public-phone" type="tel" formControlName="phone" autocomplete="tel" /><label
              for="public-email"
              >E-mail (opcional)</label
            ><input id="public-email" type="email" formControlName="email" autocomplete="email" />
            @if (error()) {
              <p role="alert" class="notice error">{{ error() }}</p>
            }
            <p class="help">
              Seus dados serão usados para organizar este atendimento. A disponibilidade será
              validada novamente na confirmação.
            </p>
            <button class="primary" [disabled]="saving()">
              {{ saving() ? 'Confirmando…' : 'Confirmar reserva' }}
            </button>
          </form>
        }
      </section>
    } @else {
      <section class="public-card panel">
        <h1>Reserva indisponível</h1>
        <p role="alert">
          {{ error() || 'Confira o link recebido ou entre em contato com o estabelecimento.' }}
        </p>
        <a routerLink="/">Voltar ao início</a>
      </section>
    }
    <dialog #cancelDialog class="confirm-dialog" aria-labelledby="public-cancel-title">
      <h2 id="public-cancel-title">Cancelar esta reserva?</h2>
      <p>O horário será liberado para outra pessoa.</p>
      <div class="row-actions">
        <button autofocus (click)="cancelDialog.close()">Manter reserva</button
        ><button class="danger" [disabled]="saving()" (click)="cancelBooking(cancelDialog)">
          Confirmar cancelamento
        </button>
      </div>
    </dialog>
  </main>`,
})
export class PublicBookingPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  slug = '';
  private contextGeneration = 0;
  private slotGeneration = 0;
  private bookingRequest: { body: string; key: string } | null = null;
  readonly context = signal<PublicContext | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly slotLoading = signal(false);
  readonly searched = signal(false);
  readonly slots = signal<string[]>([]);
  readonly confirmed = signal('');
  readonly cancellable = signal<{ id: string; token: string } | null>(null);
  readonly cancelled = signal(false);
  readonly error = signal('');
  readonly money = currency;
  readonly form = this.fb.nonNullable.group({
    service_id: ['', Validators.required],
    professional_id: ['', Validators.required],
    date: ['', Validators.required],
    start_time: ['', Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    email: ['', Validators.email],
  });
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.slug = params.get('slug') ?? '';
      this.form.reset();
      this.context.set(null);
      this.confirmed.set('');
      this.cancellable.set(null);
      this.cancelled.set(false);
      this.saving.set(false);
      this.bookingRequest = null;
      this.clearSlots();
      void this.load();
    });
  }
  brandColor(): string {
    const color = this.context()?.organization.primary_color;
    return color && /^#[a-f0-9]{6}$/i.test(color) ? color : '#5343d4';
  }
  brandInk(): string {
    const parts = this.brandColor()
      .slice(1)
      .match(/../g)
      ?.map((part) => parseInt(part, 16) / 255) ?? [0, 0, 0];
    const luminance = parts
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    return luminance > 0.18 ? '#000000' : '#ffffff';
  }
  newBooking(): void {
    this.confirmed.set('');
    this.cancellable.set(null);
    this.cancelled.set(false);
  }
  async cancelBooking(dialog: HTMLDialogElement): Promise<void> {
    const booking = this.cancellable();
    if (!booking) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.post(
        `/public/${encodeURIComponent(this.slug)}/bookings/${booking.id}/cancel`,
        { token: booking.token },
      );
      dialog.close();
      this.cancellable.set(null);
      this.cancelled.set(true);
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  timezone(): string {
    return this.context()?.organization.timezone ?? 'America/Sao_Paulo';
  }
  date(value: string): string {
    return localDateTime(value, this.timezone());
  }
  time(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.timezone(),
    }).format(new Date(value));
  }
  minimumDate(): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
  clearSlots(): void {
    this.slotGeneration++;
    this.slotLoading.set(false);
    this.slots.set([]);
    this.searched.set(false);
    this.form.controls.start_time.setValue('');
  }
  async load(): Promise<void> {
    const generation = ++this.contextGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const context = await this.api.get<PublicContext>(`/public/${encodeURIComponent(this.slug)}`);
      if (generation === this.contextGeneration) this.context.set(context);
    } catch (error) {
      if (generation === this.contextGeneration) this.error.set(errorMessage(error));
    } finally {
      if (generation === this.contextGeneration) this.loading.set(false);
    }
  }

  async loadSlots(): Promise<void> {
    const value = this.form.getRawValue();
    if (!value.service_id || !value.professional_id || !value.date) {
      this.error.set('Escolha um serviço, profissional e data.');
      return;
    }
    const generation = ++this.slotGeneration;
    this.slotLoading.set(true);
    this.error.set('');
    this.form.controls.start_time.setValue('');
    try {
      const query = new URLSearchParams({
        service_id: value.service_id,
        professional_id: value.professional_id,
        date: value.date,
      });
      const slots = await this.api.get<string[]>(
        `/public/${encodeURIComponent(this.slug)}/availability?${query}`,
      );
      if (generation !== this.slotGeneration) return;
      this.slots.set(slots);
      this.searched.set(true);
    } catch (error) {
      if (generation === this.slotGeneration) this.error.set(errorMessage(error));
    } finally {
      if (generation === this.slotGeneration) this.slotLoading.set(false);
    }
  }
  async book(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Selecione um horário e preencha nome e telefone válidos.');
      return;
    }
    const generation = this.contextGeneration;
    const slug = this.slug;
    const value = this.form.getRawValue();
    const body = {
      service_id: value.service_id,
      professional_id: value.professional_id,
      start_time: value.start_time,
      customer: { name: value.name, phone: value.phone, email: value.email || null },
    };
    const serialized = JSON.stringify(body);
    if (this.bookingRequest?.body !== serialized)
      this.bookingRequest = { body: serialized, key: crypto.randomUUID() };
    const key = this.bookingRequest.key;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.csrf();
      if (generation !== this.contextGeneration) return;
      const result = await this.api.post<{ id: string; cancellation_token: string }>(
        `/public/${encodeURIComponent(slug)}/bookings`,
        body,
        { 'Idempotency-Key': key },
      );
      if (generation !== this.contextGeneration) return;
      if (result.cancellation_token)
        this.cancellable.set({ id: result.id, token: result.cancellation_token });
      this.cancelled.set(false);
      this.confirmed.set(value.start_time);
      this.clearSlots();
    } catch (error) {
      if (generation === this.contextGeneration) this.error.set(errorMessage(error));
    } finally {
      if (generation === this.contextGeneration) this.saving.set(false);
    }
  }
}
