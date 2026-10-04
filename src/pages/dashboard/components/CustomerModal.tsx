import { PanelDialog } from "@/components/panel/panel-dialog";
import { Field, PanelButton } from "@/components/panel/primitives";

export interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
}

interface CustomerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: CustomerFormData;
  onFormChange: (data: CustomerFormData) => void;
  onSubmit: (event: React.FormEvent) => void;
  saving: boolean;
}

/**
 * Modal de cadastro/edição de cliente no padrão do painel refinado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function CustomerModal({ isOpen, onOpenChange, isEditing, formData, onFormChange, onSubmit, saving }: CustomerModalProps) {
  return (
    <PanelDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      width={480}
      title={isEditing ? "Editar cliente" : "Novo cliente"}
      description="Mantenha o contato atualizado para lembretes e confirmações."
      footer={
        <>
          <div className="flex-1" />
          <PanelButton variant="ghost" size="md" onClick={() => onOpenChange(false)}>Cancelar</PanelButton>
          <PanelButton variant="primary" size="md" type="submit" form="customer-form" disabled={saving || formData.name.trim().length < 2}>
            {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar cliente"}
          </PanelButton>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Nome completo" htmlFor="customer-name">
          <input id="customer-name" className="af-input" required autoFocus maxLength={160} value={formData.name} placeholder="Ex.: Ana Beatriz Oliveira" onChange={(event) => onFormChange({ ...formData, name: event.target.value })} />
        </Field>
        <Field label="WhatsApp" htmlFor="customer-phone">
          <input id="customer-phone" className="af-input" type="tel" inputMode="tel" maxLength={30} value={formData.phone} placeholder="(11) 98765-4321" onChange={(event) => onFormChange({ ...formData, phone: event.target.value })} />
        </Field>
        <Field label="E-mail" htmlFor="customer-email" optional>
          <input id="customer-email" className="af-input" type="email" maxLength={160} value={formData.email} placeholder="cliente@email.com" onChange={(event) => onFormChange({ ...formData, email: event.target.value })} />
        </Field>
      </form>
    </PanelDialog>
  );
}
