import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Appointment } from "../use-appointments";
import { isSameDayInSaoPaulo, useDashboardStats } from "../use-dashboard-stats";

/**
 * Cria um agendamento válido para os cenários de métricas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function createAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment-1",
    customer_name: "Cliente de teste",
    customer_phone: "62999999999",
    service_id: "service-1",
    employee_id: "employee-1",
    start_time: "2026-03-10T15:00:00.000Z",
    end_time: "2026-03-10T16:00:00.000Z",
    status: "confirmed",
    created_at: "2026-03-01T12:00:00.000Z",
    organization_id: "organization-1",
    payment_status: "pending",
    amount_paid: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("isSameDayInSaoPaulo", () => {
  it("reconhece o instante no limite UTC como o dia anterior em São Paulo", () => {
    const utcBoundaryDate = new Date("2026-01-01T02:30:00.000Z");
    const previousDayInSaoPaulo = new Date("2025-12-31T15:00:00.000Z");
    const nextDayInSaoPaulo = new Date("2026-01-01T15:00:00.000Z");

    expect(isSameDayInSaoPaulo(utcBoundaryDate, previousDayInSaoPaulo)).toBe(true);
    expect(isSameDayInSaoPaulo(utcBoundaryDate, nextDayInSaoPaulo)).toBe(false);
  });
});

describe("useDashboardStats", () => {
  it("exclui agendamento cancelado da quantidade, receita e taxa mensais", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T15:00:00.000Z"));

    const appointments: Appointment[] = [
      createAppointment({
        id: "completed-paid",
        start_time: "2026-03-02T15:00:00.000Z",
        status: "completed",
        payment_status: "paid",
        amount_paid: 120,
      }),
      createAppointment({
        id: "confirmed-paid",
        start_time: "2026-03-08T15:00:00.000Z",
        payment_status: "paid",
        service: {
          name: "Corte",
          price: 80,
          duration_minutes: 60,
        },
      }),
      createAppointment({
        id: "cancelled-paid",
        start_time: "2026-03-12T15:00:00.000Z",
        status: "cancelled",
        payment_status: "paid",
        amount_paid: 900,
      }),
    ];

    const { result } = renderHook(() => useDashboardStats(appointments));

    expect(result.current.monthAppointments).toBe(2);
    expect(result.current.monthRevenue).toBe(200);
    expect(result.current.completedRate).toBe(50);
  });
});
