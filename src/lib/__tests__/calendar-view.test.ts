import { describe, expect, it } from 'vitest';
import { Views } from 'react-big-calendar';
import { getCalendarView } from '../calendar-view';

describe('getCalendarView', () => {
  it('aceita as visualizações explicitamente suportadas', () => {
    expect(getCalendarView('day')).toBe(Views.DAY);
    expect(getCalendarView('month')).toBe(Views.MONTH);
  });

  it('usa semana como fallback para parâmetros ausentes ou inválidos', () => {
    expect(getCalendarView('week')).toBe(Views.WEEK);
    expect(getCalendarView('invalid')).toBe(Views.WEEK);
    expect(getCalendarView(null)).toBe(Views.WEEK);
  });
});
