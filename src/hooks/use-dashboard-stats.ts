import { useMemo } from "react";
import type { Appointment } from "./use-appointments";

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

interface SaoPauloDateParts {
  year: string;
  month: string;
  day: string;
}

const saoPauloDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Obtém os componentes de data de um instante no fuso operacional do produto.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function getSaoPauloDateParts(date: Date): SaoPauloDateParts | null {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = saoPauloDatePartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

/**
 * Verifica se dois instantes pertencem ao mesmo dia em America/Sao_Paulo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function isSameDayInSaoPaulo(date: Date, referenceDate: Date = new Date()): boolean {
  const dateParts = getSaoPauloDateParts(date);
  const referenceParts = getSaoPauloDateParts(referenceDate);

  return dateParts !== null
    && referenceParts !== null
    && dateParts.year === referenceParts.year
    && dateParts.month === referenceParts.month
    && dateParts.day === referenceParts.day;
}

/**
 * Formata um instante usando o fuso operacional America/Sao_Paulo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatInSaoPaulo(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale = "pt-BR",
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(date);
}

// Interface para as estatísticas do dashboard
export interface DashboardStats {
  todayAppointments: number; // Agendamentos de hoje
  monthAppointments: number; // Agendamentos do mês
  monthRevenue: number; // Receita do mês
  completedRate: number; // Taxa de conclusão (%)
}

/**
 * Calcula métricas operacionais sem incluir atendimentos cancelados.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useDashboardStats(appointments: Appointment[]): DashboardStats {
  return useMemo(() => {
    const now = new Date();
    const currentDateParts = getSaoPauloDateParts(now);

    if (!currentDateParts) {
      return {
        todayAppointments: 0,
        monthAppointments: 0,
        monthRevenue: 0,
        completedRate: 0,
      };
    }

    const todayAppointments = appointments.filter((apt) => {
      if (apt.status === "cancelled") {
        return false;
      }

      const scheduledDate = new Date(apt.start_time);
      return isSameDayInSaoPaulo(scheduledDate, now);
    });

    const monthAppointments = appointments.filter((apt) => {
      if (apt.status === "cancelled") {
        return false;
      }

      const scheduledDate = new Date(apt.start_time);
      const scheduledDateParts = getSaoPauloDateParts(scheduledDate);

      return scheduledDateParts !== null
        && scheduledDateParts.year === currentDateParts.year
        && scheduledDateParts.month === currentDateParts.month;
    });

    const monthRevenue = monthAppointments
      .filter((apt) => apt.payment_status === 'paid')
      .reduce((sum, apt) => sum + (apt.amount_paid || apt.service?.price || 0), 0);

    const completedCount = monthAppointments.filter((apt) => apt.status === "completed").length;
    const completedRate = monthAppointments.length > 0 
      ? (completedCount / monthAppointments.length) * 100 
      : 0;

    return {
      todayAppointments: todayAppointments.length,
      monthAppointments: monthAppointments.length,
      monthRevenue,
      completedRate: Math.round(completedRate),
    };
  }, [appointments]);
}
