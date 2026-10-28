import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { errorMessage } from '../core/api';
import { PendingInvitation } from '../core/pending-invitation';
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: ` <main id="conteudo" tabindex="-1" class="auth-page">
    <div class="auth-wrap">
      <header class="brand-header">
        <a routerLink="/" aria-label="AgendaFácil"
          ><img src="/assets/logo-mark.png" width="64" height="64" alt="" /></a
        ><span class="brand">Agenda<span>Fácil</span></span>
        <p>
          {{
            registerMode
              ? 'Crie sua conta e organize os atendimentos do seu negócio.'
              : 'Entre para gerenciar sua agenda.'
          }}
        </p>
      </header>
      <section class="auth-card">
        @if (pendingInvitation.available()) {
          <p class="notice">
            Há um convite aguardando. Use o e-mail indicado pelo gestor para aceitá-lo após entrar.
          </p>
        }
        <nav class="auth-tabs" aria-label="Acesso">
          <a routerLink="/login" [attr.aria-current]="!registerMode ? 'page' : null">Entrar</a
          ><a routerLink="/register" [attr.aria-current]="registerMode ? 'page' : null"
            >Criar conta</a
          >
        </nav>
        <form [formGroup]="form" (ngSubmit)="submit()">
          @if (registerMode) {
            <label for="name">Seu nome</label
            ><input id="name" autocomplete="name" formControlName="name" required />
          }
          <label for="email">E-mail</label
          ><input
            id="email"
            type="email"
            autocomplete="email"
            formControlName="email"
            required
            [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
            [attr.aria-describedby]="error() ? 'auth-error' : null"
          />
          <label for="password">Senha</label
          ><input
            id="password"
            type="password"
            [attr.autocomplete]="registerMode ? 'new-password' : 'current-password'"
            formControlName="password"
            required
          />
          @if (registerMode) {
            <label for="confirmation">Confirme sua senha</label
            ><input
              id="confirmation"
              type="password"
              autocomplete="new-password"
              formControlName="password_confirmation"
              placeholder="Repita a senha"
              aria-label="Confirme sua senha"
            />
            <p class="help">
              Use pelo menos 12 caracteres. Os dados do negócio são informados no próximo passo.
            </p>
          } @else {
            <label class="check"
              ><input type="checkbox" formControlName="remember" /> Manter conectado</label
            >
          }
          @if (error()) {
            <p id="auth-error" class="notice error" role="alert">{{ error() }}</p>
          }
          <button class="primary" type="submit" [disabled]="busy()">
            {{ busy() ? 'Aguarde…' : registerMode ? 'Criar conta' : 'Entrar' }}
          </button>
        </form>
        <p class="help">
          Acesso Google, WhatsApp e recuperação por e-mail serão disponibilizados após a homologação
          dos canais.
        </p>
      </section>
    </div>
  </main>`,
})
export class AuthPage {
  readonly pendingInvitation = inject(PendingInvitation);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly registerMode = this.route.snapshot.data['register'] === true;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    password_confirmation: [''],
    remember: [false],
  });
  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Informe um e-mail válido e sua senha.');
      return;
    }
    const value = this.form.getRawValue();
    if (
      this.registerMode &&
      (value.name.trim().length < 3 ||
        value.password.length < 12 ||
        value.password !== value.password_confirmation)
    ) {
      this.error.set(
        'Informe seu nome, uma senha de pelo menos 12 caracteres e a confirmação igual.',
      );
      return;
    }
    this.busy.set(true);
    try {
      if (this.registerMode) await this.auth.register(value);
      else await this.auth.login(value);
      await this.router.navigateByUrl(
        this.pendingInvitation.available()
          ? '/convite'
          : this.auth.identity()?.organization
            ? '/dashboard'
            : '/onboarding',
      );
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
