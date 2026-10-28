import { ChangeDetectorRef, Component, ElementRef, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Api, Organization, errorMessage } from '../core/api';
import { Auth } from '../core/auth';
import { toDataURL } from 'qrcode';
interface BusinessHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}
type BusinessHourForm = FormGroup<{
  day_of_week: FormControl<number>;
  start_time: FormControl<string>;
  end_time: FormControl<string>;
  is_active: FormControl<boolean>;
}>;
interface OrganizationSettings extends Organization {
  business_hours: BusinessHour[];
  logo_url?: string | null;
  logo_file_id?: string | null;
  settings?: {
    specialty?: string | null;
    instagram?: string | null;
    bio?: string | null;
    address?: {
      postal_code?: string | null;
      street?: string | null;
      number?: string | null;
      city?: string | null;
      state?: string | null;
    };
  };
}
interface LogoSelection {
  logo_url: string | null;
  logo_file_id: string | null;
}
@Component({
  imports: [ReactiveFormsModule],
  styles: [
    `
      textarea {
        display: block;
        width: 100%;
        min-height: 112px;
        margin-bottom: 16px;
        padding: 10px 12px;
        border: 1px solid var(--af-control-line);
        border-radius: 8px;
        background: var(--af-bg);
        color: var(--af-ink);
        font: inherit;
      }
      textarea[aria-invalid='true'] {
        border-color: var(--af-bad);
      }
    `,
  ],
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Gestão do negócio</p>
        <h1>Configurações</h1>
        <p>Identidade do negócio e seu canal de reserva.</p>
      </div>
    </header>
    @if (error()) {
      <p role="alert" class="notice error">{{ error() }}</p>
    }
    @if (success()) {
      <p role="status" class="notice success">{{ success() }}</p>
    }
    @if (loading()) {
      <p role="status">Carregando configurações…</p>
    }
    <section class="panel">
      <h2>Dados do negócio</h2>
      <form [formGroup]="form" (ngSubmit)="save()">
        <label for="settings-name">Nome do negócio</label
        ><input id="settings-name" formControlName="name" /><label for="settings-slug"
          >Link de reserva</label
        ><input id="settings-slug" formControlName="slug" /><label for="settings-color"
          >Cor da marca</label
        ><input id="settings-color" type="color" formControlName="primary_color" />
        <label for="settings-timezone">Fuso horário do negócio</label>
        <input
          id="settings-timezone"
          formControlName="timezone"
          list="supported-timezones"
          aria-describedby="timezone-help"
        />
        <datalist id="supported-timezones">
          @for (zone of timezones; track zone) {
            <option [value]="zone"></option>
          }
        </datalist>
        <p id="timezone-help" class="help">
          Use um identificador IANA. Alterar o fuso muda a apresentação dos horários; agendamentos
          existentes preservam seus instantes.
        </p>
        <h3>Perfil do negócio</h3>
        <div class="resource-form">
          <div>
            <label for="settings-specialty">Especialidade</label
            ><input id="settings-specialty" formControlName="specialty" maxlength="120" />
          </div>
          <div>
            <label for="settings-instagram">Instagram</label
            ><input
              id="settings-instagram"
              formControlName="instagram"
              maxlength="100"
              placeholder="@seunegocio"
            />
          </div>
        </div>
        <label for="settings-bio">Apresentação do negócio</label
        ><textarea id="settings-bio" formControlName="bio" maxlength="2000" rows="4"></textarea>
        <h3>Endereço</h3>
        <p class="help">
          Preencha os dados diretamente. O CEP não é consultado em serviços externos.
        </p>
        <div class="resource-form">
          <div>
            <label for="settings-postal-code">CEP</label
            ><input
              id="settings-postal-code"
              formControlName="postal_code"
              maxlength="20"
              autocomplete="postal-code"
            />
          </div>
          <div>
            <label for="settings-street">Rua ou avenida</label
            ><input
              id="settings-street"
              formControlName="street"
              maxlength="500"
              autocomplete="address-line1"
            />
          </div>
          <div>
            <label for="settings-number">Número</label
            ><input id="settings-number" formControlName="number" maxlength="20" />
          </div>
          <div>
            <label for="settings-city">Cidade</label
            ><input
              id="settings-city"
              formControlName="city"
              maxlength="100"
              autocomplete="address-level2"
            />
          </div>
          <div>
            <label for="settings-state">Estado/UF</label
            ><input
              id="settings-state"
              formControlName="state"
              maxlength="50"
              autocomplete="address-level1"
              placeholder="GO"
            />
          </div>
        </div>
        <button class="primary" [disabled]="saving() || loading()">
          {{ saving() ? 'Salvando…' : 'Salvar alterações' }}
        </button>
      </form>
    </section>
    <section class="panel">
      <h2>Logo do negócio</h2>
      <p>A imagem publicada será visível na página pública de reservas.</p>
      @if (logoPreview(); as preview) {
        <img
          [src]="preview"
          width="144"
          height="144"
          style="object-fit:contain;max-width:100%;"
          alt="Logo atual do negócio"
        />
      } @else if (logo().logo_file_id) {
        <p>
          Há um logo selecionado. Ele só será exibido quando a reserva pública estiver habilitada.
        </p>
      } @else {
        <p>Nenhum logo selecionado.</p>
      }
      <label for="settings-logo">Selecionar imagem do logo</label>
      <input
        id="settings-logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        (change)="chooseLogo($event)"
        [disabled]="logoBusy() || loading()"
        [attr.aria-invalid]="logoError() ? 'true' : null"
        [attr.aria-describedby]="logoError() ? 'logo-help logo-error' : 'logo-help'"
      />
      <p id="logo-help" class="help">
        Use PNG, JPEG ou WebP de até 2 MB. A seleção só é enviada quando você publica.
      </p>
      @if (logoError()) {
        <p id="logo-error" role="alert" class="notice error">{{ logoError() }}</p>
      }
      <div class="form-actions">
        <button
          class="primary"
          [disabled]="logoBusy() || !logoFile() || loading()"
          (click)="uploadLogo()"
        >
          {{ logoBusy() ? 'Aguarde…' : 'Publicar logo' }}
        </button>
        @if (logo().logo_file_id) {
          <button
            class="danger-quiet"
            [disabled]="logoBusy()"
            (click)="removeLogoDialog.showModal()"
          >
            Remover logo público
          </button>
        }
      </div>
    </section>
    <section class="panel">
      <h2>Expediente semanal</h2>
      <p>
        O servidor usa este expediente ao validar reservas, reagendamentos e disponibilidade
        pública.
      </p>
      <form [formGroup]="scheduleForm" (ngSubmit)="saveHours()">
        <div formArrayName="business_hours" class="business-hours">
          @for (day of hours.controls; track day.controls.day_of_week.value; let index = $index) {
            <fieldset [formGroupName]="index" class="business-hour">
              <legend>{{ weekdays[day.controls.day_of_week.value] }}</legend>
              <label class="checkbox"
                ><input type="checkbox" formControlName="is_active" /> Aberto</label
              >
              <div>
                <label [for]="'business-start-' + index">Abertura</label
                ><input
                  [id]="'business-start-' + index"
                  type="time"
                  formControlName="start_time"
                  [attr.aria-invalid]="day.controls.start_time.invalid ? 'true' : null"
                  [attr.aria-describedby]="day.invalid ? 'business-interval-error-' + index : null"
                />
              </div>
              <div>
                <label [for]="'business-end-' + index">Fechamento</label
                ><input
                  [id]="'business-end-' + index"
                  type="time"
                  formControlName="end_time"
                  [attr.aria-invalid]="
                    day.controls.end_time.invalid || day.hasError('invalidInterval') ? 'true' : null
                  "
                  [attr.aria-describedby]="day.invalid ? 'business-interval-error-' + index : null"
                />
              </div>
              @if (day.invalid) {
                <p [id]="'business-interval-error-' + index" class="field-error">
                  Informe a abertura e o fechamento. O fechamento deve ser depois da abertura.
                </p>
              }
            </fieldset>
          }
        </div>
        <button class="primary" [disabled]="saving() || loading()">Salvar expediente</button>
      </form>
    </section>
    <section class="panel">
      <h2>Compartilhe sua agenda</h2>
      <p>Seus clientes podem consultar serviços e reservar pelo link:</p>
      <a class="public-link" [href]="publicLink()" target="_blank" rel="noopener">{{
        publicLink()
      }}</a>
      <div class="form-actions"><button (click)="copyLink()">Copiar link</button></div>
      @if (qrCode()) {
        <img
          [src]="qrCode()"
          width="192"
          height="192"
          alt="QR Code do link de reserva do negócio"
        />
        <p class="help">
          Este QR Code abre o endereço deste ambiente. Gere novamente após definir o domínio de
          produção.
        </p>
      }
    </section>
    <dialog #removeLogoDialog class="confirm-dialog" aria-labelledby="remove-logo-title">
      <h2 id="remove-logo-title">Remover o logo da reserva pública?</h2>
      <p>A imagem deixará de ser publicada. O arquivo guardado será preservado.</p>
      <div class="row-actions">
        <button autofocus [disabled]="logoBusy()" (click)="removeLogoDialog.close()">
          Manter logo</button
        ><button class="danger" [disabled]="logoBusy()" (click)="removeLogo(removeLogoDialog)">
          Remover da reserva pública
        </button>
      </div>
    </dialog>
  </section>`,
})
export class SettingsPage {
  private readonly api = inject(Api);
  readonly auth = inject(Auth);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly error = signal('');
  readonly success = signal('');
  readonly saving = signal(false);
  readonly loading = signal(true);
  readonly weekdays = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  readonly timezones = Intl.supportedValuesOf('timeZone');
  readonly hours = new FormArray<BusinessHourForm>([]);
  readonly scheduleForm = this.fb.group({ business_hours: this.hours });
  readonly qrCode = signal('');
  readonly logo = signal<LogoSelection>({ logo_url: null, logo_file_id: null });
  readonly logoFile = signal<File | null>(null);
  readonly logoBusy = signal(false);
  readonly logoError = signal('');
  private readonly logoRevision = signal(0);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    timezone: ['America/Sao_Paulo', Validators.required],
    primary_color: ['#087bf5', Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    specialty: ['', Validators.maxLength(120)],
    instagram: ['', Validators.maxLength(100)],
    bio: ['', Validators.maxLength(2000)],
    postal_code: ['', Validators.maxLength(20)],
    street: ['', Validators.maxLength(500)],
    number: ['', Validators.maxLength(20)],
    city: ['', Validators.maxLength(100)],
    state: ['', Validators.maxLength(50)],
  });
  constructor() {
    const org = this.auth.identity()?.organization;
    if (org)
      this.form.patchValue({
        name: org.name,
        slug: org.slug,
        primary_color: org.primary_color ?? '#087bf5',
        timezone: org.timezone,
      });
    void this.load();
  }
  /** Carrega os sete dias persistidos, sem substituir expediente ausente por um valor inventado. @author André Narcizo */
  async load(): Promise<void> {
    try {
      const settings = await this.api.get<OrganizationSettings>('/settings');
      const profile = settings.settings;
      this.form.patchValue({
        name: settings.name,
        slug: settings.slug,
        timezone: settings.timezone,
        primary_color: settings.primary_color ?? '#087bf5',
        specialty: profile?.specialty ?? '',
        instagram: profile?.instagram ?? '',
        bio: profile?.bio ?? '',
        postal_code: profile?.address?.postal_code ?? '',
        street: profile?.address?.street ?? '',
        number: profile?.address?.number ?? '',
        city: profile?.address?.city ?? '',
        state: profile?.address?.state ?? '',
      });
      this.logo.set({
        logo_url: settings.logo_url ?? null,
        logo_file_id: settings.logo_file_id ?? null,
      });
      this.hours.clear();
      for (const hour of settings.business_hours) {
        const group = this.fb.nonNullable.group(
          {
            day_of_week: [hour.day_of_week],
            start_time: [hour.start_time.slice(0, 5), Validators.required],
            end_time: [hour.end_time.slice(0, 5), Validators.required],
            is_active: [hour.is_active],
          },
          {
            validators: (control) =>
              control.get('end_time')?.value > control.get('start_time')?.value
                ? null
                : { invalidInterval: true },
          },
        );
        this.hours.push(group);
      }
      if (this.hours.length !== 7)
        throw new Error(
          'O expediente está incompleto. Solicite verificação antes de alterar os horários.',
        );
      await this.updateQrCode();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  async saveHours(): Promise<void> {
    if (this.scheduleForm.invalid || this.hours.length !== 7) {
      this.scheduleForm.markAllAsTouched();
      this.error.set('Confira os sete dias: o fechamento deve ser depois da abertura.');
      const index = this.hours.controls.findIndex((day) => day.invalid);
      if (index >= 0) {
        const field = this.hours.at(index).controls.start_time.invalid ? 'start' : 'end';
        this.changeDetector.detectChanges();
        this.host.nativeElement
          .querySelector<HTMLInputElement>(`#business-${field}-${index}`)
          ?.focus();
      }
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.api.patch('/settings', this.scheduleForm.getRawValue());
      this.success.set('Expediente salvo. As novas reservas usarão os horários configurados.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async updateQrCode(): Promise<void> {
    try {
      this.qrCode.set(
        await toDataURL(this.publicLink(), {
          width: 192,
          margin: 2,
          color: { dark: '#092343', light: '#ffffff' },
        }),
      );
    } catch {
      this.qrCode.set('');
    }
  }
  publicLink(): string {
    return `${window.location.origin}/reservar/${this.auth.identity()?.organization?.slug ?? ''}`;
  }
  logoPreview(): string | null {
    const url = this.logo().logo_url;
    return url ? `${url}${url.includes('?') ? '&' : '?'}preview=${this.logoRevision()}` : null;
  }
  chooseLogo(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    this.logoError.set('');
    this.logoFile.set(null);
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      this.logoError.set('Selecione uma imagem PNG, JPEG ou WebP de até 2 MB.');
      return;
    }
    this.logoFile.set(file);
  }
  async uploadLogo(): Promise<void> {
    const file = this.logoFile();
    if (!file || this.logoBusy()) return;
    this.logoBusy.set(true);
    this.logoError.set('');
    this.success.set('');
    try {
      const body = new FormData();
      body.append('file', file);
      await this.api.csrf();
      this.logo.set(await this.api.post<LogoSelection>('/branding/logo', body));
      this.logoRevision.update((value) => value + 1);
      this.logoFile.set(null);
      const picker = this.host.nativeElement.querySelector<HTMLInputElement>('#settings-logo');
      if (picker) picker.value = '';
      await this.auth.refresh();
      this.success.set(
        this.logo().logo_url
          ? 'Logo publicado na reserva pública.'
          : 'Logo selecionado. Ele será exibido quando a reserva pública estiver habilitada.',
      );
    } catch (error) {
      this.logoError.set(errorMessage(error));
    } finally {
      this.logoBusy.set(false);
    }
  }
  async removeLogo(dialog: HTMLDialogElement): Promise<void> {
    this.logoBusy.set(true);
    this.logoError.set('');
    try {
      await this.api.delete('/branding/logo');
      this.logo.set({ logo_url: null, logo_file_id: null });
      await this.auth.refresh();
      dialog.close();
      this.success.set('Logo removido da reserva pública. O arquivo foi preservado.');
    } catch (error) {
      dialog.close();
      this.logoError.set(errorMessage(error));
    } finally {
      this.logoBusy.set(false);
    }
  }
  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicLink());
      this.success.set('Link copiado.');
    } catch {
      this.error.set('Não foi possível copiar. Selecione e copie o link acima.');
    }
  }
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Confira os dados do negócio e os limites dos campos informados.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const {
        specialty,
        instagram,
        bio,
        postal_code,
        street,
        number,
        city,
        state,
        ...organization
      } = this.form.getRawValue();
      await this.api.patch<Organization>('/settings', {
        ...organization,
        profile: { specialty, instagram, bio },
        address: { postal_code, street, number, city, state },
      });
      await this.auth.refresh();
      await this.updateQrCode();
      this.success.set('Configurações salvas.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
