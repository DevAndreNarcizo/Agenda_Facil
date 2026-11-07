import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AuthShellComponent } from '../../core/ui/auth-shell.component';

type Step = 'loading' | 'choose' | 'otp' | 'done' | 'unavailable';

/**
 * Página pública de reservas (/reservar/:slug). Fluxo:
 * escolher serviço/profissional/horário -> OTP (WhatsApp) -> sessão opaca -> reserva.
 */
@Component({
  selector: 'af-public-booking',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, AuthShellComponent],
  templateUrl: './public-booking.page.html',
})
export class PublicBookingPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  readonly publicBooking = inject(PublicBookingService);

  readonly step = signal<Step>('loading');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly hint = signal<string | null>(null);
  readonly confirmation = signal<{ start_time: string; end_time: string } | null>(null);

  private slug = '';

  readonly chooseForm = this.fb.nonNullable.group({
    service_id: ['', [Validators.required]],
    professional_id: ['', [Validators.required]],
    start_time: ['', [Validators.required]],
  });

  readonly otpForm = this.fb.nonNullable.group({
    phone: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    try {
      await this.publicBooking.loadContext(this.slug);
      this.step.set('choose');
    } catch {
      this.step.set('unavailable');
    }
  }

  /** Avança da escolha para o OTP (ou direto à reserva se já houver sessão). */
  async proceed(): Promise<void> {
    if (this.chooseForm.invalid) {
      this.chooseForm.markAllAsTouched();
      return;
    }
    if (this.publicBooking.portalToken(this.slug)) {
      await this.book();
      return;
    }
    this.step.set('otp');
  }

  async requestOtp(): Promise<void> {
    const phone = this.otpForm.controls.phone.value;
    if (!phone) {
      this.otpForm.controls.phone.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await this.publicBooking.requestOtp(this.slug, phone);
      this.hint.set(res.debug_code ? `Código (dev): ${res.debug_code}` : res.message);
    } finally {
      this.busy.set(false);
    }
  }

  async verifyAndBook(): Promise<void> {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { phone, code } = this.otpForm.getRawValue();
      await this.publicBooking.verifyOtp(this.slug, phone, code);
      await this.book();
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && e.status === 422
          ? 'Código inválido ou expirado.'
          : 'Não foi possível verificar o código.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private async book(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const v = this.chooseForm.getRawValue();
      const start = new Date(v.start_time).toISOString();
      const appt = await this.publicBooking.createBooking(this.slug, {
        service_id: v.service_id,
        professional_id: v.professional_id,
        start_time: start,
      });
      this.confirmation.set({ start_time: appt.start_time, end_time: appt.end_time });
      this.step.set('done');
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        this.error.set('Esse horário acabou de ser ocupado. Escolha outro.');
        this.step.set('choose');
      } else if (e instanceof HttpErrorResponse && e.status === 401) {
        this.publicBooking.logout(this.slug);
        this.error.set('Sua sessão expirou. Confirme o telefone novamente.');
        this.step.set('otp');
      } else {
        this.error.set('Não foi possível concluir a reserva.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
