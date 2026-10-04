import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Icon } from "@/components/panel/primitives";
import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  onSelect: () => void;
}

/**
 * Menu de ações por clique (três pontos, menu do usuário). Ação destrutiva sempre por último.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function RowMenu({ items, trigger, label = "Mais ações", align = "end", side = "bottom" }: {
  items: RowMenuItem[];
  trigger?: React.ReactNode;
  label?: string;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom";
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label}
            title={label}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex rounded-md p-1.5 text-af-ink3 hover:bg-af-line hover:text-af-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent"
          >
            <Icon name="more_horiz" size={18} />
          </button>
        )}
      </DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          side={side}
          sideOffset={6}
          onClick={(event) => event.stopPropagation()}
          className="af-root z-[70] min-w-[180px] rounded-af border border-af-line bg-af-surface p-1 text-af-ink shadow-[0_12px_32px_-12px_rgba(9,35,67,0.25)]"
        >
          {items.map((item, index) => (
            <React.Fragment key={item.label}>
              {item.danger && index > 0 && <DropdownPrimitive.Separator className="my-1 h-px bg-af-line" />}
              <DropdownPrimitive.Item
                onSelect={item.onSelect}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-af-surface2",
                  item.danger ? "text-af-bad" : "text-af-ink",
                )}
              >
                {item.icon && <Icon name={item.icon} size={17} className={item.danger ? "" : "text-af-ink3"} />}
                {item.label}
              </DropdownPrimitive.Item>
            </React.Fragment>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
