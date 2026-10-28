import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../core/api';
import { Auth } from '../core/auth';

interface AccessibleOrganization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role: 'owner' | 'admin' | 'employee';
  membership_id: string;
}

@Component({
  imports: [RouterLink],
  template: `<main id="conteudo" tabindex="-1" class="auth-page">
    <section class="auth-wrap panel">
      <a routerLink="/" class="brand">Agenda<span>Fácil</span></a>
      <h1>Suas organizações</h1>
      <p>
        Escolha o negócio em que deseja trabalhar. Esta lista mostra somente seus acessos ativos.
      </p>
      @if (error()) {
        <p role="alert" class="notice error">{{ error() }}</p>
      }
      @if (loading()) {
        <p role="status">Carregando organizações…</p>
      } @else if (!organizations().length) {
        <p>Você ainda não tem acesso ativo a uma organização.</p>
        <a routerLink="/onboarding" class="button primary">Cadastrar meu negócio</a>
        <p class="help">Se você recebeu um convite, abra o link compartilhado pelo gestor.</p>
      } @else {
        <ul class="appointment-list">
          @for (organization of organizations(); track organization.id) {
            <li>
              <div>
                <strong>{{ organization.name }}</strong>
                <p>{{ roles[organization.role] }} · {{ organization.timezone }}</p>
              </div>
              <button
                class="primary"
                [disabled]="
                  switching() !== null || organization.id === auth.identity()?.organization?.id
                "
                [attr.aria-label]="'Usar organização ' + organization.name"
                (click)="activate(organization)"
              >
                {{
                  switching() === organization.id
                    ? 'Alterando…'
                    : organization.id === auth.identity()?.organization?.id
                      ? 'Em uso'
                      : 'Usar organização'
                }}
              </button>
            </li>
          }
        </ul>
      }
      @if (auth.identity()?.organization) {
        <a routerLink="/dashboard" class="button">Voltar ao painel</a>
      }
    </section>
  </main>`,
})
export class OrganizationsPage {
  readonly auth = inject(Auth);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly roles = { owner: 'Proprietário', admin: 'Administrador', employee: 'Colaborador' };
  readonly organizations = signal<AccessibleOrganization[]>([]);
  readonly loading = signal(true);
  readonly switching = signal<string | null>(null);
  readonly error = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.organizations.set(await this.api.get<AccessibleOrganization[]>('/organizations'));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Esta rota fica fora do shell: telas do tenant anterior já foram destruídas antes do POST. @author André Narcizo */
  async activate(organization: AccessibleOrganization): Promise<void> {
    if (this.switching()) return;
    this.switching.set(organization.id);
    this.error.set('');
    try {
      await this.api.csrf();
      await this.api.post('/organizations/activate', { organization_id: organization.id });
      await this.auth.refresh();
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.switching.set(null);
    }
  }
}
