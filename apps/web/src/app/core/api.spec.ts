import { HttpErrorResponse } from '@angular/common/http';
import { calendarRange, currency, errorMessage, localDateTime, zonedInstant } from './api';
describe('contratos de apresentação', () => {
  it('converte horário civil do tenant sem usar o fuso do browser', () => {
    expect(zonedInstant('2026-10-25T09:30')).toBe('2026-10-25T12:30:00.000Z');
    expect(zonedInstant('2026-10-25T09:30', 'America/Manaus')).toBe('2026-10-25T13:30:00.000Z');
  });
  it('mantém a data brasileira na virada UTC', () => {
    expect(localDateTime('2026-10-26T01:30:00Z')).toContain('25/10/2026');
  });
  it('explica falta de permissão e indisponibilidade do gateway', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 403 }))).toContain('permissão');
    expect(
      errorMessage(
        new HttpErrorResponse({ status: 503, error: { message: 'Gateway não homologado' } }),
      ),
    ).toBe('Gateway não homologado');
  });
  it('preserva o motivo controlado de uma cota excedida', () => {
    expect(
      errorMessage(
        new HttpErrorResponse({ status: 403, error: { message: 'Limite do plano atingido.' } }),
      ),
    ).toBe('Limite do plano atingido.');
  });
  it('define mês e semana sem sobrepor o próximo período', () => {
    const leapMonth = calendarRange('2028-02-29', 'month');
    expect(leapMonth.days).toHaveLength(29);
    expect(leapMonth.start).toBe('2028-02-01T03:00:00.000Z');
    expect(leapMonth.end).toBe('2028-03-01T03:00:00.000Z');
    const sunday = calendarRange('2026-11-01', 'week');
    expect(sunday.days[0]).toBe('2026-10-26');
    expect(sunday.days.at(-1)).toBe('2026-11-01');
  });
  it('calcula um dia civil mesmo quando o fuso muda pelo horário de verão', () => {
    const range = calendarRange('2026-03-08', 'day', 'America/New_York');
    expect((Date.parse(range.end) - Date.parse(range.start)) / 3600000).toBe(23);
    expect(range.days).toEqual(['2026-03-08']);
  });
  it('exibe moeda a partir dos centavos recebidos da API', () => {
    expect(currency(3900)).toContain('39,00');
  });
});
