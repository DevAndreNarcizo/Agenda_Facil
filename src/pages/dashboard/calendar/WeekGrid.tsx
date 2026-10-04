import { useEffect, useState } from "react";
import type { BusinessDay } from "@/hooks/use-business-hours";
import { STATUS_META } from "@/lib/appointment-status";
import { formatDateKey, formatMinutes, getZonedParts, todayKey, weekdayOfKey } from "@/lib/agenda-time";
import { cn } from "@/lib/utils";
import { layoutDayItems, type AgendaItem } from "./agenda-model";

/** Altura de uma hora na grade (px), conforme o protótipo. */
const HOUR_HEIGHT = 52;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = (HOUR_HEIGHT * SLOT_MINUTES) / 60;

/**
 * Minuto atual no fuso operacional, atualizado a cada minuto para a linha "agora".
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function useNowParts() {
  const [now, setNow] = useState(() => getZonedParts(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(getZonedParts(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Grade de horários da Agenda (Semana = 7 colunas, Dia = 1 coluna).
 * Clique em horário vazio abre "Novo agendamento" já preenchido; dias fechados não respondem.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function WeekGrid({ days, items, window: range, businessDays, selectedKey, onSelect, onCreate }: {
  days: string[];
  items: AgendaItem[];
  window: { start: number; end: number };
  businessDays: BusinessDay[];
  selectedKey: string | null;
  onSelect: (item: AgendaItem) => void;
  onCreate: (dateKey: string, startMin: number) => void;
}) {
  const now = useNowParts();
  const today = todayKey();
  const hours = Array.from({ length: (range.end - range.start) / 60 }, (_, index) => range.start + index * 60);
  const slots = Array.from({ length: (range.end - range.start) / SLOT_MINUTES }, (_, index) => range.start + index * SLOT_MINUTES);
  const columnHeight = hours.length * HOUR_HEIGHT;
  const template = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const minWidth = days.length > 1 ? 760 : undefined;

  return (
    <div style={{ minWidth }}>
      <div className="grid border-b border-af-line" style={{ gridTemplateColumns: template }}>
        <span />
        {days.map((dateKey) => {
          const isToday = dateKey === today;
          return (
            <div key={dateKey} className="flex items-baseline gap-1.5 border-l border-af-line px-3 py-2.5">
              <span className="text-xs text-af-ink3 first-letter:uppercase">{formatDateKey(dateKey, { weekday: "short" })}</span>
              <span className={cn("text-[15px]", isToday ? "font-semibold text-af-accent" : "text-af-ink")}>
                {Number(dateKey.slice(8, 10))}
              </span>
            </div>
          );
        })}
      </div>

      <div className="relative grid" style={{ gridTemplateColumns: template }}>
        <div className="flex flex-col">
          {hours.map((hour) => (
            <div key={hour} className="box-border pr-2 pt-1 text-right text-[11px] text-af-ink3" style={{ height: HOUR_HEIGHT }}>
              {formatMinutes(hour)}
            </div>
          ))}
        </div>

        {days.map((dateKey) => {
          const business = businessDays.find((day) => day.dayOfWeek === weekdayOfKey(dateKey));
          const closed = !business?.isActive;
          const isToday = dateKey === today;
          const dayItems = layoutDayItems(items.filter((item) => item.dateKey === dateKey));
          const nowTop = ((now.minutes - range.start) / 60) * HOUR_HEIGHT;

          return (
            <div
              key={dateKey}
              className={cn("relative border-l border-af-line", isToday ? "bg-af-surface2" : closed ? "bg-af-bg" : "bg-transparent")}
              style={{ height: columnHeight }}
            >
              {slots.map((slot) => {
                const outside = closed || !business || slot < business.start || slot >= business.end;
                const label = `${formatDateKey(dateKey, { weekday: "long", day: "numeric", month: "long" })}, ${formatMinutes(slot)}`;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={closed}
                    aria-label={closed ? `${label} · fechado` : `Novo agendamento: ${label}`}
                    title={closed ? "Fechado" : `Novo agendamento às ${formatMinutes(slot)}`}
                    onClick={() => onCreate(dateKey, slot)}
                    className={cn(
                      "block w-full border-af-line text-left focus-visible:relative focus-visible:z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-af-accent",
                      slot % 60 === 0 && "border-t",
                      closed ? "cursor-default" : "cursor-pointer hover:bg-af-accent-soft",
                      !closed && outside && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--af-surface2)_6px_7px)]",
                    )}
                    style={{ height: SLOT_HEIGHT }}
                  />
                );
              })}

              {isToday && now.minutes >= range.start && now.minutes <= range.end && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[2] h-px bg-af-bad" style={{ top: nowTop }}>
                  <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-af-bad" />
                </div>
              )}

              {dayItems.map((item) => {
                const top = Math.max(0, ((item.startMin - range.start) / 60) * HOUR_HEIGHT) + 2;
                const height = Math.max(18, ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT - 4);
                const meta = STATUS_META[item.status];
                const compact = item.endMin - item.startMin <= 30;
                const width = 100 / item.lanes;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-agenda-event={item.key}
                    onClick={() => onSelect(item)}
                    aria-label={`${item.title}, ${formatMinutes(item.startMin)}–${formatMinutes(item.endMin)}, ${meta.label}`}
                    className={cn(
                      "absolute z-[3] box-border flex flex-col gap-px overflow-hidden rounded-md px-[7px] py-[5px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent",
                      meta.bg, meta.text,
                      item.kind === "block" && "border border-dashed border-af-warn",
                      item.status === "cancelled" && "line-through opacity-70",
                      selectedKey === item.key && "shadow-[0_0_0_2px_var(--af-accent)]",
                    )}
                    style={{ top, height, left: `calc(${item.lane * width}% + 4px)`, width: `calc(${width}% - 8px)` }}
                  >
                    {compact ? (
                      <span className="truncate text-[11px]"><span className="font-medium">{item.title}</span> · {formatMinutes(item.startMin)}</span>
                    ) : (
                      <>
                        <span className="truncate text-xs font-medium">{item.title}</span>
                        <span className="truncate text-[11px] opacity-80">{formatMinutes(item.startMin)} · {item.subtitle}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
