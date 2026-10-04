import type { ReactNode } from "react";
import { bookingSourceLabels } from "@/hooks/use-booking-source-metrics";
import type { Employee } from "@/hooks/use-employees";
import { Icon, IconAction, InitialsAvatar, PanelButton, StatusPill } from "@/components/panel/primitives";
import { formatDateKey, formatInstant, formatMinutes } from "@/lib/agenda-time";
import { formatCurrency, getInitials, toWhatsAppUrl } from "@/lib/format";
import type { BookingSource } from "@/lib/public-booking-source";
import type { AgendaItem } from "./agenda-model";
import { useCustomerHistory } from "./use-customer-history";

/**
 * Linha "ícone · rótulo · valor" da tabela de detalhes.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function DetailRow({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[20px_110px_minmax(0,1fr)] items-center gap-2.5 border-t border-af-line px-3.5 py-[11px] first:border-t-0">
      <Icon name={icon} size={18} className="text-af-ink3" />
      <span className="text-[13px] text-af-ink2">{label}</span>
      <span className="text-right text-[13px] font-medium">{value}</span>
    </div>
  );
}

/**
 * Painel fixo ao lado do calendário com os dados do agendamento (ou bloqueio) selecionado:
 * contato, detalhes, observações, histórico da cliente, linha do tempo e ações.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AppointmentPanel({ item, employees, busy, onClose, onConfirm, onComplete, onReschedule, onCancel, onRemoveBlock }: {
  item: AgendaItem;
  employees: Employee[];
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onComplete: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onRemoveBlock: () => void;
}) {
  const appointment = item.appointment;
  const isBlock = item.kind === "block";
  const history = useCustomerHistory(isBlock ? null : appointment);
  const employeeName = item.employeeId ? employees.find((employee) => employee.id === item.employeeId)?.full_name ?? appointment?.employee?.full_name ?? "—" : isBlock ? "Toda a equipe" : "Sem preferência";
  const dateLabel = formatDateKey(item.dateKey, { weekday: "short", day: "numeric", month: "long" });
  const timeRange = `${formatMinutes(item.startMin)} – ${formatMinutes(item.endMin)}`;
  const source = (appointment?.booking_source ?? "direct") as BookingSource;
  const sourceLabel = bookingSourceLabels[source] ?? bookingSourceLabels.direct;
  const whatsapp = toWhatsAppUrl(appointment?.customer_phone);
  const status = appointment?.status;
  const canAct = status === "pending" || status === "confirmed";
  const when = (iso: string) => formatInstant(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const timeline: { what: string; when: string }[] = appointment
    ? [
        ...(appointment.created_at ? [{ what: `Reserva feita · ${sourceLabel}`, when: when(appointment.created_at) }] : []),
        ...(appointment.reminder_sent_at ? [{ what: "Lembrete enviado por WhatsApp", when: when(appointment.reminder_sent_at) }] : []),
        {
          what: status === "pending" ? "Aguardando confirmação" : status === "cancelled" ? "Agendamento cancelado" : status === "completed" ? "Atendimento concluído" : "Confirmado",
          when: "—",
        },
      ]
    : [];

  return (
    <aside
      aria-label={isBlock ? "Detalhe do bloqueio" : "Detalhe do agendamento"}
      className="box-border flex min-w-0 flex-[1_1_100%] flex-col overflow-hidden rounded-af-lg border border-af-line bg-af-surface min-[720px]:sticky min-[720px]:top-[72px] min-[720px]:max-h-[calc(100vh-96px)] min-[720px]:flex-[0_0_clamp(300px,32%,380px)]"
    >
      <div className="flex h-[52px] flex-shrink-0 items-center gap-2 border-b border-af-line pl-[18px] pr-2.5">
        <span className="flex-1 text-sm text-af-ink2">{isBlock ? "Bloqueio de agenda" : "Agendamento"}</span>
        {!isBlock && canAct && <IconAction icon="edit" label="Editar horário" onClick={onReschedule} />}
        <IconAction icon="close" label="Fechar" onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-[22px] px-5 pb-7 pt-[22px]">
          <div className="flex items-start gap-3.5">
            {isBlock ? <InitialsAvatar icon="block" size={48} muted /> : <InitialsAvatar initials={getInitials(item.title)} size={48} />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="break-words text-[22px] font-bold leading-[1.15] tracking-[-0.02em]">{item.title}</span>
              <span className="text-[13px] text-af-ink2">
                {isBlock ? "Horário indisponível para reservas" : appointment?.customer_phone || "Sem telefone informado"}
              </span>
            </div>
            <StatusPill status={item.status} />
          </div>

          {!isBlock && (
            <div className="grid grid-cols-2 gap-2">
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-af-line2 text-[13px] font-medium text-af-ink no-underline hover:bg-af-surface2">
                  <Icon name="chat" size={18} />WhatsApp
                </a>
              ) : (
                <PanelButton size="md" icon="chat" disabled>WhatsApp</PanelButton>
              )}
              {appointment?.customer_phone ? (
                <a href={`tel:${appointment.customer_phone.replace(/[^\d+]/g, "")}`} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-af-line2 text-[13px] font-medium text-af-ink no-underline hover:bg-af-surface2">
                  <Icon name="call" size={18} />Ligar
                </a>
              ) : (
                <PanelButton size="md" icon="call" disabled>Ligar</PanelButton>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-af-lg border border-af-line">
            <DetailRow icon="calendar_today" label="Data" value={<span className="first-letter:uppercase">{dateLabel}</span>} />
            <DetailRow icon="schedule" label="Horário" value={timeRange} />
            {!isBlock && appointment && (
              <>
                <DetailRow icon="spa" label="Serviço" value={appointment.service?.name ?? "—"} />
                <DetailRow icon="timer" label="Duração" value={`${item.endMin - item.startMin} min`} />
              </>
            )}
            <DetailRow icon="person" label="Profissional" value={employeeName} />
            {!isBlock && appointment && (
              <>
                <DetailRow
                  icon="payments"
                  label="Valor"
                  value={`${formatCurrency(appointment.amount_paid || appointment.service?.price || 0)} · ${appointment.payment_status === "paid" ? "pago" : appointment.payment_status === "refunded" ? "reembolsado" : "a pagar no local"}`}
                />
                <DetailRow icon="link" label="Origem" value={sourceLabel} />
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">{isBlock ? "Motivo" : "Observações"}</span>
            <div className="rounded-af bg-af-surface2 px-3.5 py-3 text-[13px] leading-normal text-af-ink2 [text-wrap:pretty]">
              {isBlock ? item.block?.reason || "Sem motivo informado." : appointment?.notes || "Sem observações."}
            </div>
          </div>

          {!isBlock && (
            <>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold">Histórico da cliente</span>
                  {history.data && (
                    <span className="text-xs text-af-ink3">
                      {history.data.visits} {history.data.visits === 1 ? "visita" : "visitas"} · {formatCurrency(history.data.totalSpent, { compact: true })} no total
                    </span>
                  )}
                </div>
                {history.isLoading ? (
                  <div className="h-16 animate-pulse rounded-af-lg bg-af-surface2" />
                ) : !history.data || history.data.recent.length === 0 ? (
                  <span className="text-[13px] text-af-ink3">Primeiro atendimento desta cliente.</span>
                ) : (
                  <div className="flex flex-col overflow-hidden rounded-af-lg border border-af-line">
                    {history.data.recent.map((entry) => (
                      <div key={entry.id} className="flex justify-between gap-3 border-t border-af-line px-3.5 py-2.5 text-[13px] first:border-t-0">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">{entry.serviceName}</span>
                          <span className="truncate text-xs text-af-ink3">
                            {formatInstant(entry.startTime, { day: "2-digit", month: "short", year: "numeric" })}
                            {entry.employeeName ? ` · ${entry.employeeName.split(" ")[0]}` : ""}
                          </span>
                        </div>
                        <span className="whitespace-nowrap text-af-ink2">{formatCurrency(entry.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-semibold">Linha do tempo</span>
                <div className="flex flex-col gap-2.5">
                  {timeline.map((entry) => (
                    <div key={entry.what} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-2.5 text-[13px]">
                      <span className="mt-1 h-[7px] w-[7px] rounded-full bg-af-line2" />
                      <span className="text-af-ink2">{entry.what}</span>
                      <span className="whitespace-nowrap text-xs text-af-ink3">{entry.when}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {(isBlock || canAct) && (
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-af-line px-5 pb-[18px] pt-3.5">
          {status === "pending" && <PanelButton variant="primary" size="lg" disabled={busy} onClick={onConfirm}>Confirmar agendamento</PanelButton>}
          {status === "confirmed" && <PanelButton variant="primary" size="lg" disabled={busy} onClick={onComplete}>Marcar como concluído</PanelButton>}
          <div className={isBlock ? "grid grid-cols-1" : "grid grid-cols-2 gap-2"}>
            {!isBlock && <PanelButton size="md" className="h-[38px]" disabled={busy} onClick={onReschedule}>Reagendar</PanelButton>}
            <PanelButton variant="danger" size="md" className="h-[38px]" disabled={busy} onClick={isBlock ? onRemoveBlock : onCancel}>
              {isBlock ? "Remover bloqueio" : "Cancelar agendamento"}
            </PanelButton>
          </div>
        </div>
      )}
    </aside>
  );
}
