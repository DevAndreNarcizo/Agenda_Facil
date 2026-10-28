import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Resource, currency, errorMessage } from '../core/api';
@Component({
  imports: [ReactiveFormsModule],
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Gestão do negócio</p>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <button class="primary" (click)="open()">{{ createLabel }}</button>
    </header>
    @if (error()) {
      <p role="alert" class="notice error">{{ error() }}</p>
    }
    @if (success()) {
      <p role="status" class="notice success">{{ success() }}</p>
    }
    @if (editing()) {
      <section class="panel">
        <div class="section-heading">
          <h2>{{ selectedId() ? 'Editar' : 'Cadastrar' }} {{ singular }}</h2>
          <button type="button" (click)="editing.set(false)">Fechar</button>
        </div>
        <form class="resource-form" [formGroup]="form" (ngSubmit)="save()">
          <div>
            <label for="resource-name">Nome</label
            ><input id="resource-name" formControlName="name" required />
          </div>
          @if (kind === 'services') {
            <div>
              <label for="duration">Duração em minutos</label
              ><input
                id="duration"
                type="number"
                min="5"
                max="480"
                formControlName="duration_minutes"
              />
            </div>
            <div>
              <label for="price">Preço em reais</label
              ><input id="price" type="number" min="0" step="0.01" formControlName="price" />
            </div>
          }
          @if (kind === 'customers') {
            <div>
              <label for="customer-email">E-mail</label
              ><input
                id="customer-email"
                type="email"
                formControlName="email"
                autocomplete="email"
              />
            </div>
            <div>
              <label for="customer-phone">Telefone</label
              ><input id="customer-phone" type="tel" formControlName="phone" autocomplete="tel" />
            </div>
          }
          <div class="form-actions">
            <button type="submit" class="primary" [disabled]="saving()">
              {{ saving() ? 'Salvando…' : 'Salvar' }}</button
            ><button type="button" (click)="editing.set(false)">Cancelar</button>
          </div>
        </form>
      </section>
    }
    <section class="panel">
      @if (loading()) {
        <p role="status">Carregando {{ title.toLowerCase() }}…</p>
      } @else if (!items().length) {
        <div class="empty">
          <h2>Nenhum registro por aqui</h2>
          <p>{{ description }}</p>
          <button class="primary" (click)="open()">{{ createLabel }}</button>
        </div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                @if (kind === 'services') {
                  <th scope="col">Duração</th>
                  <th scope="col">Preço</th>
                }
                @if (kind === 'customers') {
                  <th scope="col">Contato</th>
                }
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr>
                  <td>
                    <strong>{{ item.name }}</strong>
                    @if (item.is_active === false) {
                      <span class="tag">Inativo</span>
                    }
                  </td>
                  @if (kind === 'services') {
                    <td>{{ item.duration_minutes }} min</td>
                    <td>{{ money(item.price_cents || 0) }}</td>
                  }
                  @if (kind === 'customers') {
                    <td>{{ item.email || item.phone || 'Não informado' }}</td>
                  }
                  <td>
                    <div class="row-actions">
                      <button (click)="open(item)" [attr.aria-label]="'Editar ' + item.name">
                        Editar</button
                      ><button
                        class="danger-quiet"
                        (click)="requestDelete(item, deleteDialog)"
                        [disabled]="saving() || item.is_active === false"
                        [attr.aria-label]="
                          (kind === 'customers' ? 'Excluir ' : 'Desativar ') + item.name
                        "
                      >
                        {{ kind === 'customers' ? 'Excluir' : 'Desativar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
    <dialog
      #deleteDialog
      class="confirm-dialog"
      aria-labelledby="delete-title"
      (close)="confirmDelete.set(null)"
    >
      <h2 id="delete-title">
        {{ kind === 'customers' ? 'Excluir' : 'Desativar' }} {{ confirmDelete()?.name }}?
      </h2>
      <p>
        Serviços e profissionais serão desativados, preservando o histórico. Clientes com
        atendimentos vinculados não podem ser excluídos.
      </p>
      <div class="row-actions">
        <button autofocus (click)="deleteDialog.close()">Manter registro</button
        ><button class="danger" [disabled]="saving()" (click)="remove(deleteDialog)">
          {{ kind === 'customers' ? 'Excluir registro' : 'Desativar registro' }}
        </button>
      </div>
    </dialog>
  </section>`,
})
export class ResourcesPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly kind = this.route.snapshot.data['kind'] as 'services' | 'professionals' | 'customers';
  readonly title = { services: 'Serviços', professionals: 'Profissionais', customers: 'Clientes' }[
    this.kind
  ];
  readonly singular = { services: 'serviço', professionals: 'profissional', customers: 'cliente' }[
    this.kind
  ];
  readonly createLabel = {
    services: 'Novo serviço',
    professionals: 'Novo profissional',
    customers: 'Novo cliente',
  }[this.kind];
  readonly description = {
    services: 'Defina os atendimentos, sua duração e seus preços.',
    professionals: 'Organize os profissionais disponíveis para atendimento.',
    customers: 'Mantenha os contatos dos seus clientes organizados.',
  }[this.kind];
  readonly items = signal<Resource[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly editing = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly confirmDelete = signal<Resource | null>(null);
  readonly money = currency;
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    duration_minutes: [30, [Validators.min(5), Validators.max(480)]],
    price: [0, Validators.min(0)],
    email: ['', Validators.email],
    phone: [''],
  });
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await this.api.get<Resource[]>(`/${this.kind}`));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  open(item?: Resource): void {
    this.selectedId.set(item?.id ?? null);
    this.form.reset({
      name: item?.name ?? '',
      duration_minutes: item?.duration_minutes ?? 30,
      price: (item?.price_cents ?? 0) / 100,
      email: item?.email ?? '',
      phone: item?.phone ?? '',
    });
    this.editing.set(true);
    this.success.set('');
  }
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Confira os campos: nome, duração, preço e e-mail devem ser válidos.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const body =
      this.kind === 'services'
        ? {
            name: value.name,
            duration_minutes: value.duration_minutes,
            price_cents: Math.round(value.price * 100),
          }
        : this.kind === 'customers'
          ? { name: value.name, email: value.email || null, phone: value.phone || null }
          : { name: value.name };
    try {
      const id = this.selectedId();
      if (id) await this.api.patch(`/${this.kind}/${id}`, body);
      else await this.api.post(`/${this.kind}`, body);
      this.editing.set(false);
      this.success.set('Registro salvo com sucesso.');
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  requestDelete(item: Resource, dialog: HTMLDialogElement): void {
    this.confirmDelete.set(item);
    dialog.showModal();
  }
  async remove(dialog: HTMLDialogElement): Promise<void> {
    const item = this.confirmDelete();
    if (!item) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.delete(`/${this.kind}/${item.id}`);
      dialog.close();
      this.success.set(
        this.kind === 'customers'
          ? 'Registro excluído.'
          : 'Registro desativado. O histórico foi preservado.',
      );
      await this.load();
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
