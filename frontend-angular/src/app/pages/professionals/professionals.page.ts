import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AgendaService } from '../../core/services/agenda.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Profissionais: listagem e cadastro. A criação respeita a cota do plano (402 no servidor),
 * traduzida para a UI com orientação de upgrade.
 */
@Component({
  selector: 'af-professionals',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './professionals.page.html',
})
export class ProfessionalsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly agenda = inject(AgendaService);
  readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  async ngOnInit(): Promise<void> {
    await this.agenda.loadProfessionals();
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.agenda.createProfessional({ name: this.form.getRawValue().name });
      this.form.reset({ name: '' });
    } catch (e) {
      this.error.set(this.describeError(e));
    } finally {
      this.saving.set(false);
    }
  }

  private describeError(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 402) {
        return 'Limite de profissionais do plano atingido. Faça upgrade para adicionar mais.';
      }
      if (e.status === 403) {
        return 'Apenas proprietário ou administrador pode cadastrar profissionais.';
      }
    }
    return 'Não foi possível salvar o profissional.';
  }
}
