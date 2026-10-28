import { ChangeDetectorRef, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Api,
  Appointment,
  Resource,
  errorMessage,
  localDateTime,
  zonedInstant,
  calendarRange,
  civilInput,
  tenantDay,
  addCalendarDays,
} from '../core/api';
import { Auth } from '../core/auth';
interface AppointmentBlock {
  id: string;
  professional_id: string | null;
  start_time: string;
  end_time: string;
}
@Component({
  imports: [ReactiveFormsModule],
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Agenda operacional</p>
        <h1>Agenda</h1>
        <p>Horários exibidos em {{ timezone() }}.</p>
      </div>
      <button class="primary" (click)="creating.set(!creating())">Novo agendamento</button>
    </header>
    @if (error()) {
      <p role="alert" class="notice error">{{ error() }}</p>
    }
    @if (success()) {
      <p role="status" class="notice success">{{ success() }}</p>
    }
    <nav class="calendar-toolbar" aria-label="Navegar no calendário">
      <div class="row-actions">
        <button (click)="navigate(-1)" aria-label="Período anterior">Anterior</button>
        <button (click)="today()">Hoje</button>
        <button (click)="navigate(1)" aria-label="Próximo período">Próximo</button>
      </div>
      <p aria-live="polite">{{ periodLabel() }}</p>
      <div class="row-actions" role="group" aria-label="Formato da agenda">
        <button [attr.aria-pressed]="display() === 'calendar'" (click)="display.set('calendar')">
          Calendário
        </button>
        <button [attr.aria-pressed]="display() === 'list'" (click)="display.set('list')">
          Lista
        </button>
      </div>
    </nav>
    <form class="panel resource-form" [formGroup]="filters" (ngSubmit)="load()">
      <div>
        <label for="calendar-date">Data de referência</label
        ><input id="calendar-date" type="date" formControlName="date" />
      </div>
      <div>
        <label for="calendar-view">Período</label
        ><select id="calendar-view" formControlName="view">
          <option value="day">Dia</option>
          <option value="week">Semana</option>
          <option value="month">Mês</option>
        </select>
      </div>
      <div>
        <label for="calendar-professional">Profissional</label
        ><select id="calendar-professional" formControlName="professional_id">
          <option value="">Todos</option>
          @for (item of professionals(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
      </div>
      <div>
        <label for="calendar-status">Status</label
        ><select id="calendar-status" formControlName="status">
          <option value="">Todos</option>
          @for (status of statuses; track status) {
            <option [value]="status">{{ labels[status] }}</option>
          }
        </select>
      </div>
      <div class="form-actions">
        <button class="primary">Aplicar filtros</button
        ><button type="button" (click)="creatingBlock.set(!creatingBlock())">
          Bloquear horário
        </button>
      </div>
    </form>
    @if (creatingBlock()) {
      <section class="panel">
        <h2>Novo bloqueio</h2>
        <p id="block-time-help" class="help">
          Informe o intervalo em {{ timezone() }}. O fim deve ser posterior ao início.
        </p>
        <form class="resource-form" [formGroup]="blockForm" (ngSubmit)="createBlock()">
          <div>
            <label for="block-professional">Profissional</label
            ><select id="block-professional" formControlName="professional_id">
              <option value="">Todos os profissionais</option>
              @for (item of professionals(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="block-start">Início do bloqueio</label
            ><input
              id="block-start"
              type="datetime-local"
              formControlName="start_time"
              required
              [attr.aria-invalid]="blockInvalid('start_time') ? 'true' : null"
              [attr.aria-describedby]="
                blockInvalid('start_time') ? 'block-time-help block-start-error' : 'block-time-help'
              "
            />
            @if (blockInvalid('start_time')) {
              <p id="block-start-error" class="field-error">Informe o início do bloqueio.</p>
            }
          </div>
          <div>
            <label for="block-end">Fim do bloqueio</label
            ><input
              id="block-end"
              type="datetime-local"
              formControlName="end_time"
              required
              [attr.aria-invalid]="blockInvalid('end_time') ? 'true' : null"
              [attr.aria-describedby]="
                blockInvalid('end_time') ? 'block-time-help block-end-error' : 'block-time-help'
              "
            />
            @if (blockInvalid('end_time')) {
              <p id="block-end-error" class="field-error">
                Informe o fim do bloqueio, depois do início.
              </p>
            }
          </div>
          <div class="form-actions">
            <button class="primary" [disabled]="saving()">Salvar bloqueio</button
            ><button type="button" (click)="creatingBlock.set(false)">Voltar</button>
          </div>
        </form>
      </section>
    }
    @if (creating()) {
      <section class="panel">
        <h2>Novo agendamento</h2>
        <form class="resource-form" [formGroup]="form" (ngSubmit)="create()">
          <div>
            <label for="appointment-service">Serviço</label
            ><select id="appointment-service" formControlName="service_id">
              <option value="">Selecione</option>
              @for (item of services(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="appointment-professional">Profissional</label
            ><select id="appointment-professional" formControlName="professional_id">
              <option value="">Selecione</option>
              @for (item of professionals(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="appointment-customer">Cliente</label
            ><select id="appointment-customer" formControlName="customer_id">
              <option value="">Selecione</option>
              @for (item of customers(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="appointment-start">Data e hora</label
            ><input
              id="appointment-start"
              type="datetime-local"
              formControlName="start_time"
              required
            />
          </div>
          <div class="form-actions">
            <button class="primary" [disabled]="saving()">
              {{ saving() ? 'Salvando…' : 'Criar agendamento' }}</button
            ><button type="button" (click)="creating.set(false)">Cancelar</button>
          </div>
        </form>
        <p class="help">Duração, preço e disponibilidade são confirmados pelo servidor.</p>
      </section>
    }
    <section class="panel">
      <div class="section-heading">
        <h2>Atendimentos</h2>
        <button (click)="load()">Atualizar agenda</button>
      </div>
      @if (loading()) {
        <p role="status">Carregando agenda…</p>
      } @else if (display() === 'calendar') {
        <p id="calendar-scroll-help" class="help calendar-scroll-help">
          A grade pode rolar para os lados. Arraste-a ou use as setas do teclado com o calendário em
          foco.
        </p>
        <div
          class="calendar-scroll"
          role="region"
          aria-label="Calendário de atendimentos"
          aria-describedby="calendar-scroll-help"
          tabindex="0"
        >
          <div
            class="calendar-grid"
            [class.month-grid]="applied().view === 'month'"
            [class.day-grid]="applied().view === 'day'"
          >
            @if (applied().view === 'month') {
              @for (weekday of weekdays; track weekday) {
                <div class="calendar-weekday" aria-hidden="true">{{ weekday }}</div>
              }
              @for (blank of monthPadding(); track blank) {
                <div class="calendar-blank" aria-hidden="true"></div>
              }
            }
            @for (day of days(); track day) {
              <section
                class="calendar-day"
                [class.today]="day === currentDay()"
                [attr.aria-label]="dayLabel(day)"
              >
                <button
                  class="calendar-day-heading"
                  (click)="showDay(day)"
                  [attr.aria-label]="'Ver agenda de ' + dayLabel(day)"
                >
                  {{ dayLabel(day) }}
                </button>
                @for (item of onDay(day); track item.id) {
                  <button
                    class="calendar-event"
                    [class.cancelled]="item.status === 'cancelled'"
                    (click)="openDetail(item, detailDialog)"
                  >
                    <strong>{{ time(item.start_time) }}–{{ time(item.end_time) }}</strong>
                    <span>{{ item.customer?.name || 'Cliente' }}</span>
                    <small
                      >{{ item.professional?.name }} ·
                      {{ labels[item.status] || item.status }}</small
                    >
                  </button>
                }
                @for (block of blocksOnDay(day); track block.id) {
                  <button
                    class="calendar-block"
                    (click)="selectedBlock.set(block); blockDialog.showModal()"
                  >
                    <strong>Bloqueio</strong
                    ><span>{{ time(block.start_time) }}–{{ time(block.end_time) }}</span>
                  </button>
                }
                @if (!onDay(day).length && !blocksOnDay(day).length) {
                  <p class="calendar-empty">Sem atendimentos</p>
                }
              </section>
            }
          </div>
        </div>
      } @else if (!visibleAppointments().length) {
        <div class="empty">
          <h3>Nenhum agendamento</h3>
          <p>Cadastre serviços, profissionais e clientes para começar.</p>
        </div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Atendimento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (item of visibleAppointments(); track item.id) {
                <tr [attr.data-appointment-id]="item.id">
                  <td>{{ date(item.start_time) }}</td>
                  <td>
                    <strong>{{ item.customer?.name || 'Cliente' }}</strong>
                    <p>{{ item.service?.name }} · {{ item.professional?.name }}</p>
                  </td>
                  <td>
                    <span class="tag" [class.success]="item.status === 'confirmed'">{{
                      labels[item.status] || item.status
                    }}</span>
                  </td>
                  <td>
                    <div class="row-actions">
                      @if (item.status === 'pending' || item.status === 'confirmed') {
                        <button
                          [disabled]="saving()"
                          (click)="openReschedule(item, rescheduleDialog)"
                        >
                          Reagendar
                        </button>
                      }
                      @if (item.status === 'pending') {
                        <button [disabled]="saving()" (click)="transition(item, 'confirmed')">
                          Confirmar
                        </button>
                      }
                      @if (item.status === 'confirmed') {
                        <button [disabled]="saving()" (click)="transition(item, 'completed')">
                          Concluir
                        </button>
                      }
                      @if (item.status === 'pending' || item.status === 'confirmed') {
                        <button
                          class="danger-quiet"
                          [disabled]="saving()"
                          (click)="requestCancel(item, cancelDialog)"
                        >
                          Cancelar
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
    @if (blocks().length) {
      <section class="panel">
        <h2>Bloqueios do período</h2>
        <ul class="appointment-list">
          @for (block of blocks(); track block.id) {
            <li>
              <div>
                <strong>Horário bloqueado</strong>
                <p>{{ date(block.start_time) }} até {{ date(block.end_time) }}</p>
              </div>
              <button (click)="selectedBlock.set(block); blockDialog.showModal()">
                Remover bloqueio
              </button>
            </li>
          }
        </ul>
      </section>
    }
    <dialog #detailDialog class="confirm-dialog" aria-labelledby="appointment-detail-title">
      @if (selected(); as item) {
        <h2 id="appointment-detail-title">{{ item.customer?.name || 'Atendimento' }}</h2>
        <p>{{ item.service?.name }} · {{ item.professional?.name }}</p>
        <p>
          {{ date(item.start_time) }} até {{ time(item.end_time) }} ·
          {{ labels[item.status] || item.status }}
        </p>
        <div class="row-actions">
          <button autofocus (click)="detailDialog.close()">Fechar detalhe</button>
          @if (item.status === 'pending') {
            <button
              class="primary"
              [disabled]="saving()"
              (click)="transitionDetail(item, 'confirmed', detailDialog)"
            >
              Confirmar
            </button>
          }
          @if (item.status === 'confirmed') {
            <button
              class="primary"
              [disabled]="saving()"
              (click)="transitionDetail(item, 'completed', detailDialog)"
            >
              Concluir
            </button>
          }
          @if (item.status === 'pending' || item.status === 'confirmed') {
            <button (click)="detailDialog.close(); openReschedule(item, rescheduleDialog)">
              Reagendar
            </button>
            <button
              class="danger-quiet"
              (click)="detailDialog.close(); requestCancel(item, cancelDialog)"
            >
              Cancelar
            </button>
          }
        </div>
      }
    </dialog>
    <dialog #cancelDialog class="confirm-dialog" aria-labelledby="calendar-cancel-title">
      <h2 id="calendar-cancel-title">Cancelar atendimento?</h2>
      <p>O horário será liberado e o histórico ficará preservado.</p>
      <div class="row-actions">
        <button autofocus (click)="cancelDialog.close()">Manter atendimento</button
        ><button class="danger" [disabled]="saving()" (click)="confirmCancel(cancelDialog)">
          Confirmar cancelamento
        </button>
      </div>
    </dialog>
    <dialog #rescheduleDialog class="confirm-dialog" aria-labelledby="reschedule-title">
      <h2 id="reschedule-title">Reagendar atendimento</h2>
      <p>Horário em {{ timezone() }}. A disponibilidade será validada pelo servidor.</p>
      <form [formGroup]="rescheduleForm" (ngSubmit)="reschedule(rescheduleDialog)">
        <label for="reschedule-start">Nova data e hora</label
        ><input id="reschedule-start" type="datetime-local" formControlName="start_time" required />
        <div class="form-actions">
          <button class="primary" [disabled]="saving()">Confirmar reagendamento</button
          ><button type="button" (click)="rescheduleDialog.close()">Voltar</button>
        </div>
      </form>
    </dialog>
    <dialog #blockDialog class="confirm-dialog" aria-labelledby="block-delete-title">
      <h2 id="block-delete-title">Remover bloqueio?</h2>
      <p>Este intervalo voltará a ficar disponível para reservas.</p>
      <div class="row-actions">
        <button autofocus (click)="blockDialog.close()">Manter bloqueio</button
        ><button class="danger" [disabled]="saving()" (click)="removeBlock(blockDialog)">
          Remover bloqueio
        </button>
      </div>
    </dialog>
  </section>`,
})
export class CalendarPage {
  private readonly api = inject(Api);
  private loadGeneration = 0;
  private readonly auth = inject(Auth);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly blockSubmitted = signal(false);
  readonly timezone = () => this.auth.identity()?.organization?.timezone ?? 'America/Sao_Paulo';
  readonly date = (value: string) => localDateTime(value, this.timezone());
  readonly appointments = signal<Appointment[]>([]);
  readonly blocks = signal<AppointmentBlock[]>([]);
  readonly selected = signal<Appointment | null>(null);
  readonly selectedBlock = signal<AppointmentBlock | null>(null);
  readonly creatingBlock = signal(false);
  readonly statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  readonly display = signal<'calendar' | 'list'>('list');
  readonly weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  readonly filters = this.fb.nonNullable.group({
    date: [tenantDay(new Date(), this.timezone()), Validators.required],
    view: ['month'],
    professional_id: [''],
    status: [''],
  });
  readonly applied = signal(this.filters.getRawValue());
  readonly days = computed(
    () => calendarRange(this.applied().date, this.applied().view, this.timezone()).days,
  );
  readonly monthPadding = computed(() => {
    const first = this.days()[0];
    if (!first) return [];
    const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
    return Array.from({ length: (weekday + 6) % 7 }, (_, index) => index);
  });
  readonly currentDay = () => tenantDay(new Date(), this.timezone());
  readonly periodLabel = computed(() => {
    const days = this.days();
    return days.length === 1
      ? this.dayLabel(days[0]!)
      : `${this.dayLabel(days[0]!)} a ${this.dayLabel(days.at(-1)!)}`;
  });
  readonly rescheduleForm = this.fb.nonNullable.group({ start_time: ['', Validators.required] });
  readonly blockForm = this.fb.nonNullable.group(
    {
      professional_id: [''],
      start_time: ['', Validators.required],
      end_time: ['', Validators.required],
    },
    {
      validators: (control) => {
        const start = control.get('start_time')?.value;
        const end = control.get('end_time')?.value;
        return start && end && end <= start ? { invalidInterval: true } : null;
      },
    },
  );
  readonly visibleAppointments = computed(() => {
    const values = this.applied();
    return this.appointments().filter(
      (item) =>
        (!values.professional_id || item.professional_id === values.professional_id) &&
        (!values.status || item.status === values.status),
    );
  });
  readonly appointmentsByDay = computed(() => {
    const groups = new Map<string, Appointment[]>();
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    for (const item of this.visibleAppointments()) {
      const day = formatter.format(new Date(item.start_time));
      const items = groups.get(day) ?? [];
      items.push(item);
      groups.set(day, items);
    }
    return groups;
  });
  readonly blocksByDay = computed(() => {
    const groups = new Map<string, AppointmentBlock[]>();
    for (const day of this.days()) {
      const start = Date.parse(zonedInstant(day + 'T00:00', this.timezone()));
      const end = Date.parse(zonedInstant(addCalendarDays(day, 1) + 'T00:00', this.timezone()));
      groups.set(
        day,
        this.blocks().filter(
          (block) =>
            Date.parse(block.start_time) < end &&
            Date.parse(block.end_time) > start &&
            (!this.applied().professional_id ||
              !block.professional_id ||
              block.professional_id === this.applied().professional_id),
        ),
      );
    }
    return groups;
  });
  readonly services = signal<Resource[]>([]);
  readonly professionals = signal<Resource[]>([]);
  readonly customers = signal<Resource[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly creating = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu',
  };
  readonly form = this.fb.nonNullable.group({
    service_id: ['', Validators.required],
    professional_id: ['', Validators.required],
    customer_id: ['', Validators.required],
    start_time: ['', Validators.required],
  });
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const values = this.filters.getRawValue();
      this.applied.set(values);
      const range = calendarRange(values.date, values.view, this.timezone());
      const query = new URLSearchParams({ start: range.start, end: range.end });
      const [appointments, services, professionals, customers, blocks] = await Promise.all([
        this.api.get<Appointment[]>(`/appointments?${query}`),
        this.api.get<Resource[]>('/services'),
        this.api.get<Resource[]>('/professionals'),
        this.api.get<Resource[]>('/customers'),
        this.api.get<AppointmentBlock[]>(`/appointment-blocks?${query}`),
      ]);
      if (generation !== this.loadGeneration) return;
      this.appointments.set(appointments);
      this.services.set(services.filter((item) => item.is_active !== false));
      this.professionals.set(professionals.filter((item) => item.is_active !== false));
      this.blocks.set(blocks);
      this.customers.set(customers);
    } catch (error) {
      if (generation === this.loadGeneration) this.error.set(errorMessage(error));
    } finally {
      if (generation === this.loadGeneration) this.loading.set(false);
    }
  }
  dayLabel(day: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${day}T12:00:00Z`));
  }
  time(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.timezone(),
    }).format(new Date(value));
  }
  onDay(day: string): Appointment[] {
    return this.appointmentsByDay().get(day) ?? [];
  }
  blocksOnDay(day: string): AppointmentBlock[] {
    return this.blocksByDay().get(day) ?? [];
  }

  openDetail(item: Appointment, dialog: HTMLDialogElement): void {
    this.selected.set(item);
    dialog.showModal();
  }
  async transitionDetail(
    item: Appointment,
    status: string,
    dialog: HTMLDialogElement,
  ): Promise<void> {
    await this.transition(item, status);
    if (!this.error()) dialog.close();
  }
  showDay(day: string): void {
    this.filters.patchValue({ date: day, view: 'day' });
    void this.load();
  }
  today(): void {
    this.filters.controls.date.setValue(this.currentDay());
    void this.load();
  }
  /** Navega por datas civis para preservar o período do tenant mesmo em outro fuso. @author André Narcizo */
  navigate(direction: number): void {
    const value = this.filters.getRawValue();
    let date = addCalendarDays(value.date, direction * (value.view === 'week' ? 7 : 1));
    if (value.view === 'month') {
      const next = new Date(`${value.date.slice(0, 7)}-01T12:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + direction);
      date = next.toISOString().slice(0, 10);
    }
    this.filters.controls.date.setValue(date);
    void this.load();
  }
  async create(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Selecione serviço, profissional, cliente e horário.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const body = this.form.getRawValue();
      await this.api.post('/appointments', {
        ...body,
        start_time: zonedInstant(body.start_time, this.timezone()),
      });
      this.creating.set(false);
      this.success.set('Agendamento criado.');
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  requestCancel(item: Appointment, dialog: HTMLDialogElement): void {
    this.selected.set(item);
    dialog.showModal();
  }
  async confirmCancel(dialog: HTMLDialogElement): Promise<void> {
    const item = this.selected();
    if (!item) return;
    await this.transition(item, 'cancelled');
    dialog.close();
  }
  openReschedule(item: Appointment, dialog: HTMLDialogElement): void {
    this.selected.set(item);
    this.rescheduleForm.setValue({ start_time: civilInput(item.start_time, this.timezone()) });
    dialog.showModal();
  }
  async reschedule(dialog: HTMLDialogElement): Promise<void> {
    const item = this.selected();
    if (!item || this.rescheduleForm.invalid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.patch(`/appointments/${item.id}`, {
        start_time: zonedInstant(this.rescheduleForm.getRawValue().start_time, this.timezone()),
      });
      dialog.close();
      this.success.set('Agendamento reagendado.');
      await this.load();
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async createBlock(): Promise<void> {
    this.blockSubmitted.set(true);
    if (this.blockForm.invalid) {
      this.blockForm.markAllAsTouched();
      this.error.set('Informe o início e o fim do bloqueio; o fim deve ser posterior ao início.');
      const field = this.blockForm.controls.start_time.invalid ? 'block-start' : 'block-end';
      this.changeDetector.detectChanges();
      this.host.nativeElement.querySelector<HTMLInputElement>(`#${field}`)?.focus();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const value = this.blockForm.getRawValue();
      await this.api.post('/appointment-blocks', {
        professional_id: value.professional_id || null,
        start_time: zonedInstant(value.start_time, this.timezone()),
        end_time: zonedInstant(value.end_time, this.timezone()),
      });
      this.creatingBlock.set(false);
      this.blockSubmitted.set(false);
      this.success.set('Horário bloqueado.');
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  blockInvalid(field: 'start_time' | 'end_time'): boolean {
    const control = this.blockForm.controls[field];
    return (
      (control.touched || this.blockSubmitted()) &&
      (control.invalid || (field === 'end_time' && this.blockForm.hasError('invalidInterval')))
    );
  }
  async removeBlock(dialog: HTMLDialogElement): Promise<void> {
    const block = this.selectedBlock();
    if (!block) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.delete(`/appointment-blocks/${block.id}`);
      dialog.close();
      this.success.set('Bloqueio removido.');
      await this.load();
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async transition(item: Appointment, status: string): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.patch(`/appointments/${item.id}`, { status });
      this.success.set('Agendamento atualizado.');
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
