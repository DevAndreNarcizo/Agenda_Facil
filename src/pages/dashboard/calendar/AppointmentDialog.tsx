import { useState, type ReactNode } from "react";
import type { Employee } from "@/hooks/use-employees";
import type { Service } from "@/hooks/use-services";
import { PanelDialog } from "@/components/panel/panel-dialog";
import { Field, Icon, PanelButton } from "@/components/panel/primitives";
import { formatDateKey, formatMinutes } from "@/lib/agenda-time";
import { cn } from "@/lib/utils";
import { findConflict, type AgendaItem } from "./agenda-model";

export interface AppointmentDraft {
  /** Presente quando é reagendamento. */
  appointmentKey?: string;
  appointmentId?: string;
  dateKey: string;
  startMin: number;
  serviceId: string;
  employeeId: string;
  customerName: string;
  customerPhone: string;
  notes: string;
}

const STEP = 30;
const LAST_START = 24 * 60 - STEP;

/**
 * Chip de seleção única (serviço, profissional): selecionado em tinta cheia, demais com contorno.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function Chip({ selected, onClick, children, ...data }: { selected: boolean; onClick: () => void; children: ReactNode; "data-service-id"?: string }) {
  return (
    <button
      {...data}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent",
        selected ? "border-af-ink bg-af-ink text-af-bg" : "border-af-line2 text-af-ink2 hover:bg-af-surface2",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Modal "Novo agendamento" / "Reagendar atendimento" com horário pré-preenchido,
 * término calculado pela duração do serviço e aviso de conflito antes de enviar.
 * A validação definitiva continua na Edge Function (fonte da verdade).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AppointmentDialog({ draft, services, employees, items, saving, onClose, onSubmit }: {
  draft: AppointmentDraft;
  services: Service[];
  employees: Employee[];
  items: AgendaItem[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: AppointmentDraft) => void;
}) {
  const [form, setForm] = useState<AppointmentDraft>(draft);
  const update = (patch: Partial<AppointmentDraft>) => setForm((current) => ({ ...current, ...patch }));
  const isReschedule = Boolean(form.appointmentId);
  const activeServices = services.filter((service) => service.is_active || service.id === form.serviceId);
  const service = activeServices.find((candidate) => candidate.id === form.serviceId);
  const duration = service?.duration_minutes ?? 30;
  const endMin = form.startMin + duration;

  const conflict = form.dateKey
    ? findConflict(items, { dateKey: form.dateKey, startMin: form.startMin, endMin, employeeId: form.employeeId || null, ignoreKey: form.appointmentKey })
    : null;
  const employeeName = employees.find((employee) => employee.id === form.employeeId)?.full_name.split(" ")[0] ?? "O profissional";
  const conflictMessage = conflict
    ? conflict.kind === "block"
      ? "Esse horário está bloqueado na agenda. Escolha outro início ou profissional."
      : `${employeeName} já tem um compromisso nesse horário. Escolha outro início ou profissional.`
    : "";
  const crossesMidnight = endMin > 24 * 60;
  const valid = Boolean(form.serviceId && form.dateKey) && !conflict && !crossesMidnight && (isReschedule || form.customerName.trim().length > 1);

  const summary = form.dateKey
    ? `${formatDateKey(form.dateKey, { weekday: "long", day: "numeric", month: "short", year: "numeric" })} · ${formatMinutes(form.startMin)} – ${formatMinutes(endMin)}`
    : "Escolha uma data";

  return (
    <PanelDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={isReschedule ? "Reagendar atendimento" : "Novo agendamento"}
      description={<span className="inline-block first-letter:uppercase">{summary}</span>}
      footer={
        <>
          <span className="hidden flex-1 text-xs text-af-ink3 min-[480px]:inline">
            {isReschedule ? "O cliente é avisado do novo horário por WhatsApp." : "O cliente recebe a confirmação por WhatsApp."}
          </span>
          <span className="flex-1 min-[480px]:hidden" />
          <PanelButton variant="ghost" size="md" onClick={onClose}>Cancelar</PanelButton>
          <PanelButton variant="primary" size="md" type="submit" form="appointment-form" disabled={!valid || saving}>
            {saving ? "Salvando…" : isReschedule ? "Reagendar" : "Criar agendamento"}
          </PanelButton>
        </>
      }
    >
      <form
        id="appointment-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSubmit(form);
        }}
      >
        {!isReschedule && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            <Field label="Nome do cliente" htmlFor="appointment-customer-name">
              <input id="appointment-customer-name" className="af-input" required maxLength={160} autoFocus value={form.customerName} placeholder="Nome completo" onChange={(event) => update({ customerName: event.target.value })} />
            </Field>
            <Field label="Telefone" htmlFor="appointment-customer-phone">
              <input id="appointment-customer-phone" className="af-input" type="tel" inputMode="tel" maxLength={30} value={form.customerPhone} placeholder="(00) 00000-0000" onChange={(event) => update({ customerPhone: event.target.value })} />
            </Field>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Serviço</span>
          {activeServices.length === 0 ? (
            <span className="text-[13px] text-af-ink3">Cadastre um serviço ativo em Serviços para agendar.</span>
          ) : (
            <div role="radiogroup" aria-label="Serviço" className="flex flex-wrap gap-1.5">
              {activeServices.map((candidate) => (
                <Chip key={candidate.id} data-service-id={candidate.id} selected={candidate.id === form.serviceId} onClick={() => update({ serviceId: candidate.id })}>
                  {candidate.name}
                  <span className="opacity-70">{candidate.duration_minutes} min</span>
                </Chip>
              ))}
            </div>
          )}
        </div>

        {employees.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Profissional</span>
            <div role="radiogroup" aria-label="Profissional" className="flex flex-wrap gap-1.5">
              {employees.map((employee) => (
                <Chip key={employee.id} selected={employee.id === form.employeeId} onClick={() => update({ employeeId: employee.id })}>
                  {employee.full_name.split(" ")[0]}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3.5">
          <Field label="Data" htmlFor="apt-date">
            <input id="apt-date" type="date" required className="af-input" value={form.dateKey} onChange={(event) => update({ dateKey: event.target.value })} />
          </Field>
          <Field label="Início">
            <div className="flex h-[38px] items-center justify-between rounded-lg border border-af-line2 bg-af-bg pl-3 pr-1 text-sm">
              <span id="apt-start" aria-live="polite">{formatMinutes(form.startMin)}</span>
              <span className="flex">
                <button type="button" aria-label="30 minutos antes" disabled={form.startMin <= 0} onClick={() => update({ startMin: Math.max(0, form.startMin - STEP) })} className="flex rounded-md p-[5px] text-af-ink2 hover:bg-af-surface2 disabled:opacity-45">
                  <Icon name="remove" size={18} />
                </button>
                <button type="button" aria-label="30 minutos depois" disabled={form.startMin >= LAST_START} onClick={() => update({ startMin: Math.min(LAST_START, form.startMin + STEP) })} className="flex rounded-md p-[5px] text-af-ink2 hover:bg-af-surface2 disabled:opacity-45">
                  <Icon name="add" size={18} />
                </button>
              </span>
            </div>
          </Field>
          <Field label="Término">
            <div className="flex h-[38px] items-center rounded-lg border border-af-line bg-af-surface2 px-3 text-sm text-af-ink2">
              {crossesMidnight ? "Após meia-noite" : formatMinutes(endMin)}
            </div>
          </Field>
        </div>

        {conflictMessage && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-af-warn-soft px-3 py-2.5 text-[13px] text-af-warn">
            <Icon name="warning" size={18} />
            {conflictMessage}
          </div>
        )}

        {!isReschedule && (
          <Field label="Observações" htmlFor="apt-notes" optional>
            <textarea
              id="apt-notes"
              maxLength={2000}
              value={form.notes}
              placeholder="Preferências, alergias, recados para a equipe"
              onChange={(event) => update({ notes: event.target.value })}
              className="af-input min-h-[72px] resize-y py-2.5"
            />
          </Field>
        )}
      </form>
    </PanelDialog>
  );
}
