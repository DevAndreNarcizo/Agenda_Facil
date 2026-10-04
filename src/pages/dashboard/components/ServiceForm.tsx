import { PanelDialog } from "@/components/panel/panel-dialog";
import { Field, PanelButton } from "@/components/panel/primitives";
import type { ServiceInput } from "@/hooks/use-services";

interface ServiceFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: ServiceInput;
  onFormChange: (data: ServiceInput) => void;
  onSubmit: (event: React.FormEvent) => void;
  saving: boolean;
}

/**
 * Modal de cadastro/edição de serviço (nome, preço, duração e descrição).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ServiceForm({ isOpen, onOpenChange, isEditing, formData, onFormChange, onSubmit, saving }: ServiceFormProps) {
  const valid = formData.name.trim().length > 1 && formData.duration_minutes >= 5 && formData.price >= 0;

  return (
    <PanelDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      width={520}
      title={isEditing ? "Editar serviço" : "Novo serviço"}
      description="Preço e duração aparecem na reserva online e definem o término na agenda."
      footer={
        <>
          <div className="flex-1" />
          <PanelButton variant="ghost" size="md" onClick={() => onOpenChange(false)}>Cancelar</PanelButton>
          <PanelButton variant="primary" size="md" type="submit" form="service-form" disabled={!valid || saving}>
            {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar serviço"}
          </PanelButton>
        </>
      }
    >
      <form id="service-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Nome do serviço" htmlFor="service-name">
          <input id="service-name" className="af-input" required autoFocus maxLength={120} value={formData.name} placeholder="Ex.: Limpeza de pele profunda" onChange={(event) => onFormChange({ ...formData, name: event.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Preço (R$)" htmlFor="service-price">
            <input id="service-price" className="af-input" type="number" min={0} step="0.01" required value={formData.price} onChange={(event) => onFormChange({ ...formData, price: Number(event.target.value) })} />
          </Field>
          <Field label="Duração (min)" htmlFor="service-duration">
            <input id="service-duration" className="af-input" type="number" min={5} step={5} required value={formData.duration_minutes} onChange={(event) => onFormChange({ ...formData, duration_minutes: Number(event.target.value) })} />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="service-description" optional>
          <input id="service-description" className="af-input" maxLength={240} value={formData.description} placeholder="Ex.: Extração, esfoliação e máscara calmante" onChange={(event) => onFormChange({ ...formData, description: event.target.value })} />
        </Field>
      </form>
    </PanelDialog>
  );
}
