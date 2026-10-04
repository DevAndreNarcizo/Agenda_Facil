import { STATUS_META } from "@/lib/appointment-status";
import { addDaysToKey, formatMinutes, mondayOfWeek, todayKey } from "@/lib/agenda-time";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "./agenda-model";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_CHIPS = 3;

/**
 * Visão mensal: semanas de segunda a domingo, até 3 itens por dia e "+N mais".
 * Clique no dia abre a visão Dia; clique no item abre o detalhe lateral.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function MonthGrid({ monthKey, items, selectedKey, onSelect, onOpenDay }: {
  /** Qualquer data do mês exibido (YYYY-MM-DD). */
  monthKey: string;
  items: AgendaItem[];
  selectedKey: string | null;
  onSelect: (item: AgendaItem) => void;
  onOpenDay: (dateKey: string) => void;
}) {
  const month = monthKey.slice(0, 7);
  const firstOfMonth = `${month}-01`;
  const gridStart = mondayOfWeek(firstOfMonth);
  const today = todayKey();
  const cells: string[] = [];
  for (let cursor = gridStart; cells.length < 42; cursor = addDaysToKey(cursor, 1)) {
    if (cells.length >= 35 && cursor.slice(0, 7) !== month) break;
    cells.push(cursor);
  }

  return (
    <div className="min-w-[640px]">
      <div className="grid grid-cols-7 border-b border-af-line">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="border-l border-af-line px-3 py-2.5 text-xs text-af-ink3 first:border-l-0">{weekday}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((dateKey, index) => {
          const inMonth = dateKey.slice(0, 7) === month;
          const dayItems = items.filter((item) => item.dateKey === dateKey);
          return (
            <div
              key={dateKey}
              className={cn(
                "flex min-h-[104px] flex-col gap-1 border-af-line p-1.5",
                index % 7 !== 0 && "border-l",
                index >= 7 && "border-t",
                !inMonth && "bg-af-bg",
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDay(dateKey)}
                aria-label={`Abrir o dia ${Number(dateKey.slice(8))}`}
                className={cn(
                  "flex h-6 w-6 items-center justify-center self-start rounded-full text-[13px] hover:bg-af-surface2",
                  dateKey === today ? "bg-af-accent font-semibold text-af-on-accent hover:bg-af-accent" : inMonth ? "text-af-ink" : "text-af-ink3",
                )}
              >
                {Number(dateKey.slice(8))}
              </button>
              {dayItems.slice(0, MAX_CHIPS).map((item) => {
                const meta = STATUS_META[item.status];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelect(item)}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-left text-[11px]",
                      meta.bg, meta.text,
                      item.status === "cancelled" && "line-through",
                      selectedKey === item.key && "shadow-[0_0_0_2px_var(--af-accent)]",
                    )}
                  >
                    {formatMinutes(item.startMin)} {item.title}
                  </button>
                );
              })}
              {dayItems.length > MAX_CHIPS && (
                <button type="button" onClick={() => onOpenDay(dateKey)} className="px-1.5 text-left text-[11px] text-af-ink2 hover:text-af-ink">
                  +{dayItems.length - MAX_CHIPS} mais
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
