import type { Appointment, AppointmentBlock } from "@/hooks/use-appointments";
import type { AgendaItemKind } from "@/lib/appointment-status";
import { getZonedParts } from "@/lib/agenda-time";

export interface AgendaItem {
  /** Identificador único na grade ("a:<id>" ou "b:<id>"). */
  key: string;
  kind: "appointment" | "block";
  status: AgendaItemKind;
  title: string;
  subtitle: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  employeeId: string | null;
  appointment?: Appointment;
  block?: AppointmentBlock;
}

export interface PositionedItem extends AgendaItem {
  /** Faixa ocupada dentro do grupo de sobreposição (0-based). */
  lane: number;
  /** Total de faixas do grupo; largura do bloco = 1 / lanes. */
  lanes: number;
}

const MINUTES_IN_DAY = 24 * 60;

/**
 * Converte início/fim de um evento em minutos do dia local, limitando eventos que cruzam a meia-noite.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function toDayRange(startIso: string, endIso: string): { dateKey: string; startMin: number; endMin: number } {
  const start = getZonedParts(new Date(startIso));
  const end = getZonedParts(new Date(endIso));
  const endMin = end.dateKey === start.dateKey ? end.minutes : MINUTES_IN_DAY;
  return { dateKey: start.dateKey, startMin: start.minutes, endMin: Math.max(endMin, start.minutes + 15) };
}

/**
 * Normaliza agendamentos e bloqueios em itens de agenda no fuso operacional.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildAgendaItems(appointments: Appointment[], blocks: AppointmentBlock[], visibleStatuses: string[]): AgendaItem[] {
  const appointmentItems = appointments
    .filter((appointment) => visibleStatuses.includes(appointment.status))
    .map<AgendaItem>((appointment) => ({
      key: `a:${appointment.id}`,
      kind: "appointment",
      status: appointment.status,
      title: appointment.customer_name,
      subtitle: appointment.service?.name ?? "Serviço",
      employeeId: appointment.employee_id ?? null,
      appointment,
      ...toDayRange(appointment.start_time, appointment.end_time),
    }));

  const blockItems = blocks.map<AgendaItem>((block) => ({
    key: `b:${block.id}`,
    kind: "block",
    status: "block",
    title: block.reason?.trim() || "Bloqueio",
    subtitle: "Bloqueio de agenda",
    employeeId: block.employee_id,
    block,
    ...toDayRange(block.start_time, block.end_time),
  }));

  return [...appointmentItems, ...blockItems].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
}

/**
 * Distribui itens sobrepostos de um mesmo dia em faixas lado a lado (algoritmo guloso por grupo).
 * Cada grupo é um conjunto transitivamente sobreposto; todos os itens do grupo dividem a mesma largura.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function layoutDayItems(items: AgendaItem[]): PositionedItem[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result: PositionedItem[] = [];
  let group: PositionedItem[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    group.forEach((item) => result.push({ ...item, lanes }));
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.startMin >= groupEnd && group.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    group.push({ ...item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, item.endMin);
  }
  if (group.length > 0) flush();

  return result;
}

/**
 * Detecta conflito de horário para um profissional: agendamentos ativos dele
 * e bloqueios dele ou da organização inteira (employeeId nulo).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function findConflict(
  items: AgendaItem[],
  candidate: { dateKey: string; startMin: number; endMin: number; employeeId: string | null; ignoreKey?: string },
): AgendaItem | null {
  return items.find((item) => {
    if (item.key === candidate.ignoreKey || item.dateKey !== candidate.dateKey) return false;
    if (item.status === "cancelled") return false;
    const sameResource = item.kind === "block"
      ? item.employeeId === null || item.employeeId === candidate.employeeId
      : candidate.employeeId !== null && item.employeeId === candidate.employeeId;
    return sameResource && candidate.startMin < item.endMin && item.startMin < candidate.endMin;
  }) ?? null;
}
