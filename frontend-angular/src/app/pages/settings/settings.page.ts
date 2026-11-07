import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OrganizationService } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Configurações / identidade visual: nome do negócio, cor da marca e logo.
 * Alteração restrita a gestores (owner/admin) no servidor.
 */
@Component({
  selector: 'af-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './settings.page.html',
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly org = inject(OrganizationService);
  readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    primary_color: ['#087bf5', [Validators.pattern(/^#([0-9a-fA-F]{6})$/)]],
  });

  async ngOnInit(): Promise<void> {
    const state = this.org.state() ?? (await this.org.load());
    this.form.patchValue({
      name: state.name,
      primary_color: state.primary_color ?? '#087bf5',
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.org.updateIdentity({ name: v.name, primary_color: v.primary_color });
      this.message.set('Identidade atualizada.');
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && e.status === 403
          ? 'Apenas proprietário ou administrador pode alterar a identidade.'
          : 'Não foi possível salvar.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
