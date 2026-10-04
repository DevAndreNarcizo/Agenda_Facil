import type { AppointmentStatus } from "@/lib/appointment-filters";

export type AgendaItemKind = AppointmentStatus | "block";

export interface StatusMeta {
  label: string;
  /** Cor sólida/texto (classe Tailwind). */
  text: string;
  /** Fundo claro (classe Tailwind). */
  bg: string;
  /** Ponto indicador (classe Tailwind). */
  dot: string;
  /** Borda na cor do status (legenda). */
  border: string;
}

/**
 * Linguagem visual única dos status de agendamento no painel.
 * Confirmado = verde, Pendente = âmbar, Concluído = azul, Cancelado = vermelho, Bloqueio = neutro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const STATUS_META: Record<AgendaItemKind, StatusMeta> = {
  confirmed: { label: "Confirmado", text: "text-af-ok", bg: "bg-af-ok-soft", dot: "bg-af-ok", border: "border-af-ok" },
  completed: { label: "Concluído", text: "text-af-accent", bg: "bg-af-accent-soft", dot: "bg-af-accent", border: "border-af-accent" },
  pending: { label: "Pendente", text: "text-af-pend", bg: "bg-af-pend-soft", dot: "bg-af-pend", border: "border-af-pend" },
  cancelled: { label: "Cancelado", text: "text-af-bad", bg: "bg-af-bad-soft", dot: "bg-af-bad", border: "border-af-bad" },
  block: { label: "Bloqueio", text: "text-af-warn", bg: "bg-af-warn-soft", dot: "bg-af-warn", border: "border-af-warn" },
};

/** Status exibidos por padrão na agenda ("Ativos"). */
export const ACTIVE_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed"];
