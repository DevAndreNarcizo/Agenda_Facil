import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthShellComponent } from '../../core/ui/auth-shell.component';
import { IconComponent } from '../../core/ui/icon.component';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

/**
 * Cadastro do proprietário + organização (provisionamento transacional no servidor).
 */
@Component({
  selector: 'af-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive, AuthShellComponent, IconComponent],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    org_name: ['', [Validators.required]],
    org_slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.register(this.form.getRawValue());
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      this.error.set(
        status === 422 ? 'Verifique os dados (e-mail já usado ou slug inválido).' : 'Falha no cadastro.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
