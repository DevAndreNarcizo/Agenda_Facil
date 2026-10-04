import { useState } from "react";
import type { Employee } from "@/hooks/use-employees";
import { PanelDialog } from "@/components/panel/panel-dialog";
import { Field, PanelButton } from "@/components/panel/primitives";
import { formatMinutes, timeToMinutes } from "@/lib/agenda-time";

export interface BlockDraft {
  dateKey: string;
  startMin: number;
  endMin: number;
  employeeId: string;
  reason: string;
}

/**
 * Modal "Novo bloqueio": impede novas reservas no período, para um profissional ou para toda a equipe.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function BlockDialog({ draft, employees, saving, onClose, onSubmit }: {
  draft: BlockDraft;
  employees: Employee[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: BlockDraft) => void;
}) {
  const [form, setForm] = useState<BlockDraft>(draft);
  const update = (patch: Partial<BlockDraft>) => setForm((current) => ({ ...current, ...patch }));
  const valid = Boolean(form.dateKey) && form.endMin > form.startMin;

  return (
    <PanelDialog
      open
      width={480}
      onOpenChange={(open) => !open && onClose()}
      title="Novo bloqueio"
      description="Impede novos agendamentos no período selecionado."
      footer={
        <>
          <div className="flex-1" />
          <PanelButton variant="ghost" size="md" onClick={onClose}>Cancelar</PanelButton>
          <PanelButton variant="primary" size="md" type="submit" form="block-form" disabled={!valid || saving}>
            {saving ? "Salvando…" : "Criar bloqueio"}
          </PanelButton>
        </>
      }
    >
      <form
        id="block-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSubmit(form);
        }}
      >
        <Field label="Profissional" htmlFor="block-employee">
          <select id="block-employee" className="af-input" value={form.employeeId} onChange={(event) => update({ employeeId: event.target.value })}>
            <option value="">Toda a equipe</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3.5">
          <Field label="Data" htmlFor="block-date">
            <input id="block-date" type="date" required className="af-input" value={form.dateKey} onChange={(event) => update({ dateKey: event.target.value })} />
          </Field>
          <Field label="Início" htmlFor="block-start">
            <input id="block-start" type="time" step={1800} required className="af-input" value={formatMinutes(form.startMin)} onChange={(event) => event.target.value && update({ startMin: timeToMinutes(event.target.value) })} />
          </Field>
          <Field label="Término" htmlFor="block-end" error={form.endMin <= form.startMin ? "Depois do início" : undefined}>
            <input id="block-end" type="time" step={1800} required className="af-input" value={formatMinutes(form.endMin)} onChange={(event) => event.target.value && update({ endMin: timeToMinutes(event.target.value) })} />
          </Field>
        </div>
        <Field label="Motivo" htmlFor="block-reason" optional>
          <input id="block-reason" className="af-input" maxLength={500} value={form.reason} placeholder="Almoço, treinamento, folga…" onChange={(event) => update({ reason: event.target.value })} />
        </Field>
      </form>
    </PanelDialog>
  );
}
