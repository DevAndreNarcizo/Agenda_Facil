import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconAction } from "@/components/panel/primitives";

/**
 * Modal centralizado do painel (até 520px, raio 12, corpo com rolagem e rodapé fixo).
 * Construído direto sobre o Radix para não alterar o Dialog usado nas telas públicas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function PanelDialog({ open, onOpenChange, title, description, footer, width = 520, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="af-root fixed inset-0 z-[60] bg-af-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="af-root fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-af-lg border border-af-line bg-af-surface text-af-ink shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        >
          <div className="flex items-start gap-3 border-b border-af-line px-5 pb-3.5 pt-[18px]">
            <div className="flex flex-1 flex-col gap-[3px]">
              <DialogPrimitive.Title className="m-0 text-xl font-bold tracking-[-0.02em]">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-[13px] text-af-ink2">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconAction icon="close" label="Fechar" size={20} />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">{children}</div>
          {footer && <div className="flex items-center gap-2 border-t border-af-line px-5 py-3.5">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
