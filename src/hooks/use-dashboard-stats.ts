import { useMemo } from "react";
import type { Appointment } from "./use-appointments";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

// Interface para as estatísticas do dashboard
export interface DashboardStats {
  todayAppointments: number; // Agendamentos de hoje
  monthAppointments: number; // Agendamentos do mês
  monthRevenue: number; // Receita do mês
  completedRate: number; // Taxa de conclusão (%)
}

// Hook para calcular estatísticas do dashboard
export function useDashboardStats(appointments: Appointment[]): DashboardStats {
  return useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Filtrar agendamentos de hoje
    const todayAppointments = appointments.filter((apt) => {
      const scheduledDate = new Date(apt.start_time);
      return isWithinInterval(scheduledDate, { start: todayStart, end: todayEnd });
    });

    // Filtrar agendamentos do mês
    const monthAppointments = appointments.filter((apt) => {
      const scheduledDate = new Date(apt.start_time);
      return isWithinInterval(scheduledDate, { start: monthStart, end: monthEnd });
    });

    // Calcular receita do mês (apenas agendamentos completados)
    const monthRevenue = monthAppointments
      .filter((apt) => apt.status === "completed")
      .reduce((sum, apt) => sum + (apt.service?.price || 0), 0);

    // Calcular taxa de conclusão
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
