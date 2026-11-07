import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AgendaService } from '../../core/services/agenda.service';
import { APPOINTMENT_STATUS } from '../../core/ui/helpers';
import type { AppointmentStatus } from '../../core/models';

/**
 * Agenda operacional: lista o dia, cria agendamentos e altera status.
 * O servidor garante anti-overlap (409) e cotas (402) — a UI apenas informa.
 */
@Component({
  selector: 'af-agenda',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './agenda.page.html',
})
export class AgendaPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly agenda = inject(AgendaService);
  readonly statusMeta = APPOINTMENT_STATUS;

  readonly day = signal<string>(new Date().toISOString().slice(0, 10));
  readonly loading = signal(true);
  readonly message = signal<string | null>(null);
  readonly creating = signal(false);

  readonly form = this.fb.nonNullable.group({
    service_id: ['', [Validators.required]],
    professional_id: ['', [Validators.required]],
    start_time: ['', [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.agenda.loadServices(), this.agenda.loadProfessionals()]);
    await this.reload();
    this.loading.set(false);
  }

  async reload(): Promise<void> {
    const from = `${this.day()}T00:00:00`;
    const to = `${this.day()}T23:59:59`;
    await this.agenda.loadAppointments(from, to);
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.message.set(null);
    try {
      const v = this.form.getRawValue();
      const service = this.agenda.services().find((s) => s.id === v.service_id);
      const start = new Date(v.start_time);
      const end = new Date(start.getTime() + (service?.duration_minutes ?? 60) * 60000);
      await this.agenda.createAppointment({
        service_id: v.service_id,
        professional_id: v.professional_id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      this.form.reset({ service_id: '', professional_id: '', start_time: '' });
      await this.reload();
      this.message.set('Agendamento criado.');
    } catch (e) {
      this.message.set(this.describeError(e));
    } finally {
      this.creating.set(false);
    }
  }

  async setStatus(id: string, status: AppointmentStatus): Promise<void> {
    await this.agenda.updateStatus(id, status);
    await this.reload();
  }

  private describeError(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 409) {
        return 'Conflito de horário: já existe um agendamento nesse período para o profissional.';
      }
      if (e.status === 402) {
        return 'Limite do plano atingido. Faça upgrade para continuar.';
      }
    }
    return 'Não foi possível criar o agendamento.';
  }
}
