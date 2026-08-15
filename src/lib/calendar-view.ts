import type { View } from 'react-big-calendar';
import { Views } from 'react-big-calendar';

/**
 * Converte o parâmetro de URL em uma visualização suportada pelo calendário.
 *
 * @author André Narcizo
 */
export function getCalendarView(value: string | null): View {
  if (value === 'day') return Views.DAY;
  if (value === 'month') return Views.MONTH;
  return Views.WEEK;
}
