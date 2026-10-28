import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage, localDateTime } from '../core/api';
import { Auth } from '../core/auth';

interface TeamMember {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'employee';
  status: 'active' | 'revoked';
}
interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  status: 'pending' | 'expired' | 'accepted' | 'revoked';
}
interface CreatedInvitation {
  id: string;
  invitation_token: string | null;
  expires_at: string;
  delivery?: 'manual';
  already_pending?: boolean;
}
type TeamAction = { kind: 'member' | 'invitation' | 'transfer'; id: string; label: string };

@Component({
  imports: [ReactiveFormsModule],
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Acessos do negócio</p>
        <h1>Equipe e convites</h1>
        <p>Profissionais da agenda e contas de acesso são cadastros separados.</p>
      </div>
      <button (click)="load()" [disabled]="busy()">Atualizar equipe</button>
    </header>
    @if (error()) {
      <p role="alert" class="notice error">{{ error() }}</p>
    }
    @if (success()) {
      <p role="status" class="notice success">{{ success() }}</p>
    }
    <section class="panel">
      <h2>Convidar pessoa</h2>
      <p>O convite é entregue manualmente. Copie o link e compartilhe com a pessoa indicada.</p>
      <form class="resource-form" [formGroup]="form" (ngSubmit)="invite()">
        <div>
          <label for="invitation-email">E-mail do convidado</label
          ><input
            id="invitation-email"
            type="email"
            formControlName="email"
            autocomplete="off"
            [attr.aria-invalid]="
              form.controls.email.touched && form.controls.email.invalid ? 'true' : null
            "
            aria-describedby="invitation-email-help"
          />
          <p id="invitation-email-help" class="help">
            O aceite exige uma conta autenticada com este mesmo e-mail.
          </p>
        </div>
        <div>
          <label for="invitation-role">Permissão</label
          ><select id="invitation-role" formControlName="role">
            <option value="employee">Colaborador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="primary" [disabled]="busy()">
            {{ busy() ? 'Aguarde…' : 'Criar convite' }}
          </button>
        </div>
      </form>
      @if (generated(); as invitation) {
        <section class="notice" aria-label="Convite criado">
          <p>
            <strong>Compartilhamento manual</strong> · válido até {{ date(invitation.expires_at) }}.
          </p>
          <label for="generated-invitation">Link do convite</label
          ><input id="generated-invitation" type="text" readonly [value]="invitation.link" />
          <button (click)="copyInvitation()">Copiar link do convite</button>
          <p class="help">
            O link só é exibido agora e não fica salvo neste navegador. Se o perder, revogue o
            convite e crie outro.
          </p>
        </section>
      }
    </section>
    @if (loading()) {
      <p role="status">Carregando equipe…</p>
    } @else {
      <section class="panel">
        <h2>Membros</h2>
        @if (!members().length) {
          <p>Nenhum membro encontrado. Atualize a página ou verifique seu acesso.</p>
        } @else {
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Permissão</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (member of members(); track member.id) {
                  <tr>
                    <td>
                      <strong>{{ member.name }}</strong>
                      <p>{{ member.email }}</p>
                    </td>
                    <td>{{ roles[member.role] }}</td>
                    <td>{{ member.status === 'active' ? 'Ativo' : 'Revogado' }}</td>
                    <td>
                      <div class="row-actions">
                        @if (member.status === 'active') {
                          <button
                            class="danger-quiet"
                            [disabled]="busy() || member.role === 'owner'"
                            (click)="prepare('member', member.id, member.name, confirmation)"
                          >
                            Revogar acesso
                          </button>
                          @if (
                            auth.role() === 'owner' && member.user_id !== auth.identity()?.user?.id
                          ) {
                            <button
                              [disabled]="busy()"
                              (click)="prepare('transfer', member.id, member.name, confirmation)"
                            >
                              Transferir propriedade
                            </button>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <p class="help">
          O proprietário deve transferir a propriedade antes de revogar seu acesso. O servidor
          protege o último proprietário ativo.
        </p>
      </section>
      <section class="panel">
        <h2>Convites</h2>
        @if (!invitations().length) {
          <p>Nenhum convite criado para esta organização.</p>
        } @else {
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Permissão</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (invitation of invitations(); track invitation.id) {
                  <tr>
                    <td>{{ invitation.email }}</td>
                    <td>{{ roles[invitation.role] }}</td>
                    <td>{{ invitationStatuses[invitation.status] }}</td>
                    <td>{{ date(invitation.expires_at) }}</td>
                    <td>
                      @if (invitation.status === 'pending') {
                        <button
                          class="danger-quiet"
                          [disabled]="busy()"
                          (click)="
                            prepare('invitation', invitation.id, invitation.email, confirmation)
                          "
                        >
                          Revogar convite
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
    <dialog #confirmation class="confirm-dialog" aria-labelledby="team-confirm-title">
      <h2 id="team-confirm-title">
        {{
          action()?.kind === 'transfer'
            ? 'Transferir propriedade?'
            : action()?.kind === 'invitation'
              ? 'Revogar convite?'
              : 'Revogar acesso?'
        }}
      </h2>
      <p>{{ action()?.label }}</p>
      @if (action()?.kind === 'transfer') {
        <p>A pessoa escolhida se tornará proprietária. Sua permissão passará para administrador.</p>
      } @else {
        <p>
          O acesso correspondente deixará de ser válido. Esta ação será conferida pelo servidor.
        </p>
      }
      <div class="row-actions">
        <button autofocus [disabled]="busy()" (click)="confirmation.close()">
          Manter como está</button
        ><button class="danger" [disabled]="busy()" (click)="confirm(confirmation)">
          Confirmar {{ action()?.kind === 'transfer' ? 'transferência' : 'revogação' }}
        </button>
      </div>
    </dialog>
  </section>`,
})
export class MembershipsPage {
  readonly auth = inject(Auth);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly members = signal<TeamMember[]>([]);
  readonly invitations = signal<TeamInvitation[]>([]);
  readonly generated = signal<{ id: string; link: string; expires_at: string } | null>(null);
  readonly action = signal<TeamAction | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly roles = { owner: 'Proprietário', admin: 'Administrador', employee: 'Colaborador' };
  readonly invitationStatuses = {
    pending: 'Pendente',
    expired: 'Expirado',
    accepted: 'Aceito',
    revoked: 'Revogado',
  };
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['employee' as 'admin' | 'employee', Validators.required],
  });
  readonly date = (value: string) =>
    localDateTime(value, this.auth.identity()?.organization?.timezone);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [members, invitations] = await Promise.all([
        this.api.get<TeamMember[]>('/memberships'),
        this.api.get<TeamInvitation[]>('/memberships/invitations'),
      ]);
      this.members.set(members);
      this.invitations.set(invitations);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async invite(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Informe um e-mail válido e a permissão do convidado.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    this.generated.set(null);
    try {
      const result = await this.api.post<CreatedInvitation>(
        '/memberships/invitations',
        this.form.getRawValue(),
      );
      if (result.invitation_token) {
        const link = new URL('/convite', window.location.origin);
        link.hash = new URLSearchParams({ token: result.invitation_token }).toString();
        this.generated.set({ id: result.id, link: link.toString(), expires_at: result.expires_at });
        this.success.set('Convite criado. Copie o link para compartilhamento manual.');
      } else {
        this.success.set(
          'Já existe um convite pendente. Se você perdeu o link, revogue-o e crie outro.',
        );
      }
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async copyInvitation(): Promise<void> {
    const invitation = this.generated();
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.link);
      this.success.set('Link copiado. Compartilhe-o somente com a pessoa convidada.');
    } catch {
      this.error.set('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }

  prepare(kind: TeamAction['kind'], id: string, label: string, dialog: HTMLDialogElement): void {
    this.action.set({ kind, id, label });
    dialog.showModal();
  }

  async confirm(dialog: HTMLDialogElement): Promise<void> {
    const action = this.action();
    if (!action) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      if (action.kind === 'transfer') {
        await this.api.post('/memberships/transfer', { membership_id: action.id });
        await this.auth.refresh();
        this.success.set('Propriedade transferida. Sua permissão agora é de administrador.');
      } else if (action.kind === 'invitation') {
        await this.api.delete(`/memberships/invitations/${action.id}`);
        if (this.generated()?.id === action.id) this.generated.set(null);
        this.success.set('Convite revogado. O link não poderá mais ser aceito.');
      } else {
        const self =
          this.members().find((member) => member.id === action.id)?.user_id ===
          this.auth.identity()?.user.id;
        await this.api.delete(`/memberships/${action.id}`);
        if (self) {
          dialog.close();
          await this.auth.refresh();
          await this.router.navigateByUrl('/organizations');
          return;
        }
        this.success.set('Acesso revogado.');
      }
      dialog.close();
      await this.load();
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
