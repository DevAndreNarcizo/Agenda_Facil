import { PanelDialog } from "@/components/panel/panel-dialog";
import { PanelButton } from "@/components/panel/primitives";

/**
 * Confirmação de ação destrutiva no padrão de voz do produto
 * ("Cancelar agendamento? O cliente será avisado.") — substitui window.confirm.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ConfirmDialog({ open, title, description, confirmLabel, busy, onConfirm, onOpenChange }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      width={420}
      title={title}
      footer={
        <>
          <div className="flex-1" />
          <PanelButton variant="ghost" size="md" onClick={() => onOpenChange(false)}>Voltar</PanelButton>
          <PanelButton size="md" disabled={busy} onClick={onConfirm} className="border-transparent bg-af-bad text-white hover:bg-af-bad hover:opacity-90">
            {busy ? "Aguarde…" : confirmLabel}
          </PanelButton>
        </>
      }
    >
      <p className="m-0 text-sm text-af-ink2 [text-wrap:pretty]">{description}</p>
    </PanelDialog>
  );
}
