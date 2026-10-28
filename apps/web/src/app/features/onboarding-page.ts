import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, Organization, errorMessage } from '../core/api';
import { Auth } from '../core/auth';

/** Configuração em memória; uma única requisição persiste todo o onboarding. @author André Narcizo */
@Component({
  imports: [ReactiveFormsModule],
  template: `<main id="conteudo" tabindex="-1" class="auth-page onboarding-page">
    <section class="auth-card onboarding-card" aria-labelledby="onboarding-heading">
      <header class="onboarding-brand">
        <img src="/assets/logo-mark.png" width="44" height="44" alt="" />
        <span class="brand">Agenda<span>Fácil</span></span>
      </header>
      <div class="onboarding-progress">
        <p id="onboarding-progress-label">Etapa {{ step() + 1 }} de 6 · {{ stepLabels[step()] }}</p>
        <progress
          [value]="step() + 1"
          max="6"
          aria-labelledby="onboarding-progress-label"
          [attr.aria-valuetext]="'Etapa ' + (step() + 1) + ' de 6: ' + stepLabels[step()]"
        ></progress>
        <ol aria-label="Etapas da configuração">
          @for (label of stepLabels; track label; let index = $index) {
            <li
              [class.current]="index === step()"
              [class.complete]="index < step()"
              [attr.aria-current]="index === step() ? 'step' : null"
              [attr.aria-label]="'Etapa ' + (index + 1) + ': ' + label"
            >
              <span aria-hidden="true">{{ index + 1 }}</span>
              <span class="step-label">{{ label }}</span>
            </li>
          }
        </ol>
      </div>
      <h1 #stepHeading id="onboarding-heading" tabindex="-1">{{ headings[step()] }}</h1>
      <p>{{ descriptions[step()] }}</p>
      @if (error()) {
        <p id="onboarding-error" role="alert" class="notice error">{{ error() }}</p>
      }
      @if (step() < 5) {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @switch (step()) {
            @case (0) {
              <label for="business-name">Nome do negócio</label>
              <input
                id="business-name"
                formControlName="name"
                autocomplete="organization"
                maxlength="120"
                required
                [attr.aria-invalid]="invalid(form.controls.name)"
                [attr.aria-describedby]="invalid(form.controls.name) ? 'onboarding-error' : null"
              />
              <label for="onboarding-slug">Link de reserva</label>
              <input
                id="onboarding-slug"
                formControlName="slug"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                maxlength="80"
                required
                [attr.aria-invalid]="invalid(form.controls.slug)"
                [attr.aria-describedby]="
                  invalid(form.controls.slug)
                    ? 'onboarding-error onboarding-link-help'
                    : 'onboarding-link-help'
                "
              />
              <p id="onboarding-link-help" class="help">
                Use letras minúsculas, números e hífens. Seu link será /reservar/{{
                  form.controls.slug.value || 'seu-negocio'
                }}.
              </p>
              <label for="onboarding-timezone">Fuso horário</label>
              <select id="onboarding-timezone" formControlName="timezone">
                <option value="America/Sao_Paulo">Brasília · America/Sao_Paulo</option>
                <option value="America/Manaus">Manaus · America/Manaus</option>
                <option value="America/Rio_Branco">Rio Branco · America/Rio_Branco</option>
                <option value="America/Noronha">Fernando de Noronha · America/Noronha</option>
              </select>
            }
            @case (1) {
              <div formGroupName="profile" class="onboarding-fields">
                <div>
                  <label for="onboarding-specialty">Especialidade principal (opcional)</label>
                  <input id="onboarding-specialty" formControlName="specialty" maxlength="120" />
                </div>
                <div>
                  <label for="onboarding-instagram">Instagram profissional (opcional)</label>
                  <input
                    id="onboarding-instagram"
                    formControlName="instagram"
                    maxlength="100"
                    placeholder="@seu_perfil"
                    autocapitalize="none"
                  />
                </div>
                <div class="full-width">
                  <label for="onboarding-bio">Biografia curta (opcional)</label>
                  <textarea
                    id="onboarding-bio"
                    formControlName="bio"
                    rows="4"
                    maxlength="2000"
                  ></textarea>
                </div>
              </div>
            }
            @case (2) {
              <div formGroupName="address" class="onboarding-fields">
                <div>
                  <label for="onboarding-postal-code">CEP (opcional)</label>
                  <input
                    id="onboarding-postal-code"
                    formControlName="postal_code"
                    autocomplete="postal-code"
                    inputmode="numeric"
                    maxlength="9"
                    placeholder="00000-000"
                    [attr.aria-invalid]="invalid(form.controls.address.controls.postal_code)"
                    [attr.aria-describedby]="
                      invalid(form.controls.address.controls.postal_code)
                        ? 'onboarding-error'
                        : null
                    "
                  />
                </div>
                <div>
                  <label for="onboarding-number">Número (opcional)</label>
                  <input id="onboarding-number" formControlName="number" maxlength="20" />
                </div>
                <div class="full-width">
                  <label for="onboarding-street">Rua ou avenida (opcional)</label>
                  <input
                    id="onboarding-street"
                    formControlName="street"
                    autocomplete="address-line1"
                    maxlength="500"
                  />
                </div>
                <div>
                  <label for="onboarding-city">Cidade (opcional)</label>
                  <input
                    id="onboarding-city"
                    formControlName="city"
                    autocomplete="address-level2"
                    maxlength="100"
                  />
                </div>
                <div>
                  <label for="onboarding-state">Estado (opcional)</label>
                  <select
                    id="onboarding-state"
                    formControlName="state"
                    autocomplete="address-level1"
                  >
                    <option value="">Selecione a UF</option>
                    @for (state of states; track state) {
                      <option [value]="state">{{ state }}</option>
                    }
                  </select>
                </div>
              </div>
            }
            @case (3) {
              <div formGroupName="initial_service" class="onboarding-fields">
                <div class="full-width">
                  <label for="onboarding-service-name">Nome do serviço inicial</label>
                  <input
                    id="onboarding-service-name"
                    formControlName="name"
                    maxlength="120"
                    required
                    [attr.aria-invalid]="invalid(form.controls.initial_service.controls.name)"
                    [attr.aria-describedby]="
                      invalid(form.controls.initial_service.controls.name)
                        ? 'onboarding-error'
                        : null
                    "
                  />
                </div>
                <div>
                  <label for="onboarding-service-price">Preço em reais</label>
                  <input
                    id="onboarding-service-price"
                    type="number"
                    min="0"
                    step="0.01"
                    formControlName="price"
                    required
                    [attr.aria-invalid]="invalid(form.controls.initial_service.controls.price)"
                    [attr.aria-describedby]="
                      invalid(form.controls.initial_service.controls.price)
                        ? 'onboarding-error'
                        : null
                    "
                  />
                </div>
                <div>
                  <label for="onboarding-service-duration">Duração em minutos</label>
                  <input
                    id="onboarding-service-duration"
                    type="number"
                    min="5"
                    max="480"
                    step="1"
                    formControlName="duration_minutes"
                    required
                    [attr.aria-invalid]="
                      invalid(form.controls.initial_service.controls.duration_minutes)
                    "
                    [attr.aria-describedby]="
                      invalid(form.controls.initial_service.controls.duration_minutes)
                        ? 'onboarding-error'
                        : null
                    "
                  />
                </div>
                <div class="full-width">
                  <label for="onboarding-service-category">Categoria (opcional)</label>
                  <input
                    id="onboarding-service-category"
                    formControlName="category"
                    maxlength="80"
                  />
                </div>
              </div>
            }
            @case (4) {
              <p class="help">Os horários seguem o fuso {{ form.controls.timezone.value }}.</p>
              <div formArrayName="business_hours" class="onboarding-hours">
                @for (day of displayDays; track day) {
                  <fieldset
                    [formGroupName]="day"
                    class="onboarding-day"
                    [attr.aria-invalid]="hours.at(day).touched && hours.at(day).invalid"
                    [attr.aria-describedby]="
                      hours.at(day).touched && hours.at(day).invalid ? 'onboarding-error' : null
                    "
                  >
                    <legend>{{ weekdays[day] }}</legend>
                    <label class="day-open"
                      ><input type="checkbox" formControlName="is_active" /> Aberto</label
                    >
                    <div>
                      <label [for]="'onboarding-start-' + day">Abertura</label
                      ><input
                        [id]="'onboarding-start-' + day"
                        type="time"
                        formControlName="start_time"
                        required
                      />
                    </div>
                    <div>
                      <label [for]="'onboarding-end-' + day">Fechamento</label
                      ><input
                        [id]="'onboarding-end-' + day"
                        type="time"
                        formControlName="end_time"
                        required
                      />
                    </div>
                  </fieldset>
                }
              </div>
            }
          }
          <div class="form-actions onboarding-actions">
            @if (step() > 0) {
              <button type="button" (click)="back()" [disabled]="busy()">Voltar</button>
            }
            <button type="submit" class="primary" [disabled]="busy()">
              {{
                busy()
                  ? 'Criando sua agenda…'
                  : step() === 4
                    ? 'Finalizar e criar agenda'
                    : 'Continuar'
              }}
            </button>
          </div>
        </form>
      } @else if (created(); as organization) {
        <div class="onboarding-success" role="status">
          <span class="material-symbols-outlined success-icon" aria-hidden="true"
            >check_circle</span
          >
          <p>
            A organização e seu primeiro serviço foram cadastrados. Agora cadastre os profissionais
            para começar a receber reservas.
          </p>
          <p>Seu link de reserva:</p>
          <a class="onboarding-public-link" [href]="publicLink()" target="_blank" rel="noopener">{{
            publicLink()
          }}</a>
          <button class="primary" (click)="enterDashboard()" [disabled]="busy()">
            {{ busy() ? 'Abrindo…' : 'Entrar no painel' }}
          </button>
        </div>
      }
    </section>
  </main>`,
  styles: `
    .onboarding-page {
      align-items: flex-start;
      padding-block: 32px;
    }
    .onboarding-card {
      max-width: 800px;
    }
    .onboarding-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .onboarding-progress > p {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    progress {
      display: block;
      width: 100%;
      height: 8px;
      accent-color: var(--af-accent);
      margin-bottom: 16px;
    }
    ol {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0 0 28px;
    }
    li {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      color: var(--af-ink3);
      font-size: 11px;
    }
    li > span:first-child {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--af-line2);
      border-radius: 50%;
    }
    li.current {
      color: var(--af-ink);
      font-weight: 600;
    }
    li.current > span:first-child,
    li.complete > span:first-child {
      border-color: var(--af-accent);
      background: var(--af-accent-soft);
      color: var(--af-ink);
    }
    h1 {
      font-family: 'Plus Jakarta Sans Variable', sans-serif;
    }
    .onboarding-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 18px;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    textarea {
      display: block;
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--af-line2);
      background: var(--af-surface);
      color: var(--af-ink);
      font: inherit;
      resize: vertical;
    }
    .onboarding-actions {
      justify-content: flex-end;
      margin-top: 24px;
    }
    .onboarding-hours {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .onboarding-day {
      display: grid;
      grid-template-columns: 100px 1fr 1fr;
      gap: 12px;
      align-items: center;
      min-width: 0;
      border: 1px solid var(--af-line2);
      border-radius: 10px;
      padding: 12px;
      margin: 0;
    }
    .onboarding-day legend {
      padding-inline: 4px;
      font-weight: 600;
      font-size: 12px;
    }
    .onboarding-day input {
      margin-bottom: 0;
    }
    .day-open {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0;
    }
    .day-open input {
      width: auto;
      min-height: 24px;
    }
    .onboarding-success {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    .onboarding-public-link {
      overflow-wrap: anywhere;
      max-width: 100%;
    }
    @media (max-width: 599px) {
      .onboarding-fields {
        grid-template-columns: 1fr;
      }
      .step-label {
        display: none;
      }
      .onboarding-day {
        grid-template-columns: 1fr 1fr;
      }
      .day-open {
        grid-column: 1 / -1;
      }
      .onboarding-actions button {
        flex: 1;
      }
    }
  `,
})
export class OnboardingPage {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('stepHeading');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly step = signal(0);
  readonly created = signal<Organization | null>(null);
  readonly stepLabels = ['Boas-vindas', 'Perfil', 'Endereço', 'Serviço', 'Horários', 'Sucesso'];
  readonly headings = [
    'Vamos preparar sua agenda',
    'Perfil profissional',
    'Endereço do negócio',
    'Primeiro serviço',
    'Horários de funcionamento',
    'Tudo pronto!',
  ];
  readonly descriptions = [
    'Comece com o nome e o link do seu negócio.',
    'Conte aos clientes um pouco sobre seu trabalho.',
    'Informe onde seus clientes podem encontrar seu negócio. Os dados são opcionais.',
    'Cadastre um atendimento para começar. Você poderá incluir outros serviços no painel.',
    'Defina em quais dias e horários você atende.',
    'Sua agenda foi configurada com sucesso.',
  ];
  readonly weekdays = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  readonly displayDays = [1, 2, 3, 4, 5, 6, 0];
  readonly states = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ];
  readonly hours = this.fb.array(
    Array.from({ length: 7 }, (_, day) =>
      this.fb.nonNullable.group(
        {
          day_of_week: [day],
          start_time: ['08:00', [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
          end_time: [
            day === 0 || day === 6 ? '13:00' : '18:00',
            [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)],
          ],
          is_active: [day > 0 && day < 6],
        },
        {
          validators: (control) =>
            control.get('end_time')?.value > control.get('start_time')?.value
              ? null
              : { invalidInterval: true },
        },
      ),
    ),
  );
  readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120),
        Validators.pattern(/\S/),
      ],
    ],
    slug: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    timezone: ['America/Sao_Paulo', Validators.required],
    profile: this.fb.nonNullable.group({
      specialty: ['', Validators.maxLength(120)],
      instagram: ['', Validators.maxLength(100)],
      bio: ['', Validators.maxLength(2000)],
    }),
    address: this.fb.nonNullable.group({
      postal_code: ['', Validators.pattern(/^\d{5}-?\d{3}$/)],
      street: ['', Validators.maxLength(500)],
      number: ['', Validators.maxLength(20)],
      city: ['', Validators.maxLength(100)],
      state: ['', Validators.pattern(/^[A-Z]{2}$/)],
    }),
    initial_service: this.fb.nonNullable.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(120),
          Validators.pattern(/\S/),
        ],
      ],
      duration_minutes: [
        30,
        [Validators.required, Validators.min(5), Validators.max(480), Validators.pattern(/^\d+$/)],
      ],
      price: [
        0,
        [
          Validators.required,
          Validators.min(0),
          Validators.max(1000000),
          Validators.pattern(/^\d+(?:\.\d{1,2})?$/),
        ],
      ],
      category: ['', Validators.maxLength(80)],
    }),
    business_hours: this.hours,
  });

  invalid(control: { invalid: boolean; touched: boolean }): boolean {
    return control.invalid && control.touched;
  }

  back(): void {
    if (this.busy() || this.step() < 1 || this.step() === 5) return;
    this.error.set('');
    this.moveTo(this.step() - 1);
  }

  /** Valida a etapa atual e só grava ao confirmar os horários. @author André Narcizo */
  async submit(): Promise<void> {
    if (this.busy() || this.step() === 5) return;
    this.error.set('');
    const stage = this.step();
    const controls =
      stage === 0
        ? [this.form.controls.name, this.form.controls.slug, this.form.controls.timezone]
        : [
            stage === 1
              ? this.form.controls.profile
              : stage === 2
                ? this.form.controls.address
                : stage === 3
                  ? this.form.controls.initial_service
                  : this.hours,
          ];
    if (controls.some((control) => control.invalid)) {
      for (const control of controls) control.markAllAsTouched();
      this.error.set(
        [
          'Preencha o nome e um link válido para continuar.',
          'Confira os dados do perfil e os limites de tamanho.',
          'Confira o CEP e a sigla do estado.',
          'Informe o nome, um preço válido e a duração do serviço entre 5 e 480 minutos.',
          'Confira os sete dias: o fechamento deve ser depois da abertura.',
        ][stage]!,
      );
      this.focusHeading();
      return;
    }
    if (stage < 4) {
      this.moveTo(stage + 1);
      return;
    }
    if (this.form.invalid) {
      this.error.set(
        'Há dados inválidos nas etapas anteriores. Volte para conferir antes de finalizar.',
      );
      this.focusHeading();
      return;
    }
    this.busy.set(true);
    try {
      if (!this.created()) {
        const organization = await this.api.post<Organization>('/onboarding', this.payload());
        if (!organization?.id || !organization.slug)
          throw new Error('O servidor não confirmou os dados da organização. Tente novamente.');
        this.created.set(organization);
      }
      this.moveTo(5);
      try {
        await this.auth.refresh();
      } catch {
        this.error.set(
          'Sua agenda foi criada, mas não foi possível atualizar o acesso. Tente abrir o painel novamente.',
        );
      }
    } catch (error) {
      this.error.set(errorMessage(error));
      this.focusHeading();
    } finally {
      this.busy.set(false);
    }
  }

  /** Mantém centavos e dias canônicos no contrato sem aceitar tenant ou papel do formulário. @author André Narcizo */
  payload() {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      slug: value.slug.trim(),
      timezone: value.timezone,
      profile: {
        specialty: value.profile.specialty.trim(),
        instagram: value.profile.instagram.trim(),
        bio: value.profile.bio.trim(),
      },
      address: {
        ...value.address,
        postal_code: value.address.postal_code.trim(),
        street: value.address.street.trim(),
        number: value.address.number.trim(),
        city: value.address.city.trim(),
        state: value.address.state.toUpperCase(),
      },
      initial_service: {
        name: value.initial_service.name.trim(),
        duration_minutes: value.initial_service.duration_minutes,
        price_cents: Math.round(value.initial_service.price * 100),
        category: value.initial_service.category.trim(),
      },
      business_hours: value.business_hours,
    };
  }

  publicLink(): string {
    const slug = this.created()?.slug ?? this.form.controls.slug.value;
    return `${window.location.origin}/reservar/${encodeURIComponent(slug)}`;
  }

  async enterDashboard(): Promise<void> {
    if (this.busy() || !this.created()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.refresh();
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(errorMessage(error));
      this.focusHeading();
    } finally {
      this.busy.set(false);
    }
  }

  private moveTo(step: number): void {
    this.step.set(step);
    this.focusHeading();
  }

  private focusHeading(): void {
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
}
