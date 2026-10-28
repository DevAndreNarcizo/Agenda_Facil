import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../core/api';
import { Auth } from '../core/auth';
import { PendingInvitation } from '../core/pending-invitation';

@Component({
  imports: [RouterLink],
  template: `<main id="conteudo" tabindex="-1" class="auth-page">
    <section class="auth-wrap panel">
      <a routerLink="/" class="brand">Agenda<span>Fácil</span></a>
      <h1>Convite para a equipe</h1>
      @if (checking()) {
        <p role="status">Verificando sua sessão…</p>
      } @else if (!pending.available()) {
        <p role="alert">{{ error() || 'Abra o link de convite compartilhado pelo gestor.' }}</p>
        <p class="help">
          O convite fica somente nesta sessão da página. Se você a recarregou, abra o link
          novamente.
        </p>
        <a routerLink="/login" class="button">Entrar na minha conta</a>
      } @else {
        <p>
          Use o mesmo e-mail indicado pelo gestor. O aceite confirma seu acesso à organização
          convidante.
        </p>
        @if (auth.identity(); as identity) {
          <p>
            Você está conectado como <strong>{{ identity.user.email }}</strong
            >.
          </p>
          <div class="form-actions">
            <button class="primary" [disabled]="busy()" (click)="accept()">
              {{ busy() ? 'Aceitando…' : 'Aceitar convite' }}
            </button>
            <button [disabled]="busy()" (click)="changeAccount()">Usar outra conta</button>
          </div>
        } @else {
          <div class="form-actions">
            <a routerLink="/login" class="button primary">Entrar para aceitar</a>
            <a routerLink="/register" class="button">Criar conta para aceitar</a>
          </div>
        }
        @if (error()) {
          <p role="alert" class="notice error">{{ error() }}</p>
        }
      }
    </section>
  </main>`,
})
export class InvitationPage {
  readonly auth = inject(Auth);
  readonly pending = inject(PendingInvitation);
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly checking = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    this.route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => {
      if (!fragment) return;
      this.error.set('');
      if (!this.pending.capture(new URLSearchParams(fragment).get('token')))
        this.error.set('Este link de convite é inválido. Solicite um novo ao gestor.');
      // Não manter segredo no histórico, no Referer ou em parâmetros de login.
      void this.router.navigate([], {
        relativeTo: this.route,
        fragment: undefined,
        replaceUrl: true,
      });
    });
    void this.loadSession();
  }

  private async loadSession(): Promise<void> {
    try {
      await this.auth.ensure();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.checking.set(false);
    }
  }

  async accept(): Promise<void> {
    const token = this.pending.token();
    if (!token || !this.auth.identity()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.csrf();
      await this.api.post('/memberships/accept', { token });
      this.pending.clear();
      await this.auth.refresh();
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && [404, 410].includes(error.status)
          ? 'Convite inválido, expirado, revogado ou associado a outro e-mail. Confirme os dados com o gestor.'
          : errorMessage(error),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async changeAccount(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
