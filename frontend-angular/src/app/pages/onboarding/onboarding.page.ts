import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OrganizationService } from '../../core/services/organization.service';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Onboarding do negócio: identidade, primeiro serviço e horários de funcionamento.
 * Reactive Forms tipado; conclusão transacional no servidor.
 */
@Component({
  selector: 'af-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './onboarding.page.html',
})
export class OnboardingPage {
  private readonly fb = inject(FormBuilder);
  private readonly org = inject(OrganizationService);
  private readonly router = inject(Router);

  readonly weekdays = WEEKDAYS;
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    business_name: ['', [Validators.required, Validators.maxLength(120)]],
    segment: ['estetica', [Validators.required]],
    service_name: ['', [Validators.required]],
    service_duration: [60, [Validators.required, Validators.min(1)]],
    service_price: [0, [Validators.min(0)]],
    schedule: this.fb.array(
      WEEKDAYS.map((_, day) =>
        this.fb.nonNullable.group({
          active: [day !== 0],
          start: ['09:00', [Validators.required]],
          end: ['18:00', [Validators.required]],
        }),
      ),
    ),
  });

  get schedule(): FormArray {
    return this.form.get('schedule') as FormArray;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.org.completeOnboarding({
        business_name: v.business_name,
        segment: v.segment,
        schedule: v.schedule.map((s, day) => ({
          day_of_week: day,
          start: s.start,
          end: s.end,
          active: s.active,
        })),
        first_service: {
          name: v.service_name,
          duration_minutes: v.service_duration,
          price_cents: Math.round(v.service_price * 100),
        },
      });
      await this.router.navigate(['/agenda']);
    } catch {
      this.error.set('Não foi possível concluir o onboarding. Verifique os dados.');
    } finally {
      this.submitting.set(false);
    }
  }
}
