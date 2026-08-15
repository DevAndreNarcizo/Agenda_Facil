import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAppointmentUtcRange,
  normalizeAppointmentFilters,
} from '../appointment-filters';

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeAppointmentFilters', () => {
  it('aplica fallbacks e limites aos parâmetros inválidos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T02:00:00.000Z'));

    const filters = normalizeAppointmentFilters(
      new URLSearchParams(
        'date=2026-02-30&view=year&employee=not-a-uuid&status=pending,invalid,cancelled,pending&page=0&pageSize=999',
      ),
    );

    expect(filters).toEqual({
      date: '2026-03-14',
      view: 'week',
      statuses: ['pending', 'cancelled'],
      page: 1,
      pageSize: 100,
    });
  });

  it('aceita os valores suportados e limita pageSize ao mínimo', () => {
    const filters = normalizeAppointmentFilters(
      new URLSearchParams(
        'date=2026-03-10&view=day&employee=123E4567-E89B-12D3-A456-426614174000&status=confirmed,completed&page=4&pageSize=1',
      ),
    );

    expect(filters).toEqual({
      date: '2026-03-10',
      view: 'day',
      employeeId: '123e4567-e89b-12d3-a456-426614174000',
      statuses: ['confirmed', 'completed'],
      page: 4,
      pageSize: 10,
    });
  });
});

describe('getAppointmentUtcRange', () => {
  it('retorna a semana em UTC a partir do domingo no fuso de São Paulo', () => {
    const range = getAppointmentUtcRange('2026-03-10', 'week');

    expect(range.start.toISOString()).toBe('2026-03-08T03:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-03-15T03:00:00.000Z');
  });
});
