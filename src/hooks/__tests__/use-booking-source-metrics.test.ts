import { describe, expect, it, vi } from 'vitest';

// O módulo importa o cliente Supabase, que exige variáveis de ambiente; aqui só a função pura importa.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { buildBookingSourceMetrics } from '../use-booking-source-metrics';

describe('buildBookingSourceMetrics', () => {
  it('soma contagens agregadas e trata origens desconhecidas como diretas', () => {
    const metrics = buildBookingSourceMetrics([
      { booking_source: 'instagram', total: 3 },
      { booking_source: 'direct', total: 4 },
      { booking_source: 'legado', total: 1 },
      { booking_source: null, total: 2 },
    ]);
    const bySource = Object.fromEntries(metrics.map((metric) => [metric.source, metric]));

    expect(bySource.instagram.count).toBe(3);
    expect(bySource.direct.count).toBe(7);
    expect(bySource.direct.percentage).toBe(70);
    expect(metrics.reduce((sum, metric) => sum + metric.count, 0)).toBe(10);
  });

  it('retorna zeros sem dividir por zero quando não há reservas', () => {
    expect(buildBookingSourceMetrics([]).every((metric) => metric.count === 0 && metric.percentage === 0)).toBe(true);
  });
});
