import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../core/api';
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<main id="conteudo" tabindex="-1" class="auth-page">
    <div class="auth-wrap">
      <header class="brand-header">
        <a routerLink="/login" aria-label="AgendaFácil"
          ><img src="/assets/logo-mark.png" width="64" height="64" alt="" /></a
        ><span class="brand">Agenda<span>Fácil</span></span>
        <h1>{{ resetMode ? 'Defina uma nova senha' : 'Esqueceu sua senha?' }}</h1>
      </header>
      <section class="auth-card">
        @if (message()) {
          <p role="status" class="notice success">{{ message() }}</p>
        }
        @if (error()) {
          <p role="alert" class="notice error">{{ error() }}</p>
        }
        @if (!complete()) {
          <p>
            {{
              resetMode
                ? 'Use uma senha exclusiva com pelo menos 12 caracteres.'
                : 'Informe seu e-mail para receber as instruções de recuperação.'
            }}
          </p>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <label for="recovery-email">E-mail</label
            ><input
              id="recovery-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              required
            />
            @if (resetMode) {
              <label for="new-password">Nova senha</label
              ><input
                id="new-password"
                type="password"
                formControlName="password"
                autocomplete="new-password"
                minlength="12"
                required
              /><label for="new-confirmation">Confirme sua nova senha</label
              ><input
                id="new-confirmation"
                type="password"
                formControlName="password_confirmation"
                autocomplete="new-password"
                required
              />
            }
            <button class="primary" [disabled]="busy()">
              {{ busy() ? 'Aguarde…' : resetMode ? 'Redefinir senha' : 'Enviar instruções' }}
            </button>
          </form>
        }
        <div class="form-actions"><a routerLink="/login">Voltar para o login</a></div>
      </section>
    </div>
  </main>`,
})
export class PasswordPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly resetMode = this.route.snapshot.data['reset'] === true;
  private readonly fragment = new URLSearchParams(this.route.snapshot.fragment ?? '');
  private readonly token = this.fragment.get('token') ?? '';
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly complete = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: [this.fragment.get('email') ?? '', [Validators.required, Validators.email]],
    password: [''],
    password_confirmation: [''],
  });
  constructor() {
    if (this.route.snapshot.fragment)
      history.replaceState(null, '', location.pathname + location.search);
    if (this.resetMode && !this.token)
      this.error.set('O link de recuperação está incompleto. Solicite um novo link.');
  }
  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.error.set('Informe um e-mail válido.');
      return;
    }
    const value = this.form.getRawValue();
    if (
      this.resetMode &&
      (!this.token || value.password.length < 12 || value.password !== value.password_confirmation)
    ) {
      this.error.set(
        'Informe uma senha de pelo menos 12 caracteres e a confirmação igual. Use um link de recuperação válido.',
      );
      return;
    }
    this.busy.set(true);
    try {
      await this.api.csrf();
      const result = await this.api.post<{ message: string }>(
        this.resetMode ? '/auth/reset-password' : '/auth/forgot-password',
        this.resetMode ? { ...value, token: this.token } : { email: value.email },
      );
      this.message.set(result.message);
      this.complete.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
