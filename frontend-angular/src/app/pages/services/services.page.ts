import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AgendaService } from '../../core/services/agenda.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Serviços: listagem e cadastro (apenas gestores no servidor; a UI reflete via isManager).
 */
@Component({
  selector: 'af-services',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './services.page.html',
})
export class ServicesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly agenda = inject(AgendaService);
  readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    duration_minutes: [60, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.min(0)]],
  });

  async ngOnInit(): Promise<void> {
    await this.agenda.loadServices();
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.agenda.createService({
        name: v.name,
        duration_minutes: v.duration_minutes,
        price_cents: Math.round(v.price * 100),
      });
      this.form.reset({ name: '', duration_minutes: 60, price: 0 });
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && e.status === 403
          ? 'Apenas proprietário ou administrador pode cadastrar serviços.'
          : 'Não foi possível salvar o serviço.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  formatPrice(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  }
}
