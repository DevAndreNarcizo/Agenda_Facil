import { describe, expect, it } from 'vitest';
import { resolveBookingSource } from '@/lib/public-booking-source';

describe('resolveBookingSource', () => {
  it('prioriza src quando ele é uma origem permitida', () => {
    expect(resolveBookingSource('?src=qr&utm_source=instagram')).toBe('qr');
  });

  it('aceita utm_source para os canais suportados', () => {
    expect(resolveBookingSource('?utm_source=Instagram')).toBe('instagram');
  });

  it('descarta parâmetros arbitrários e usa direct', () => {
    expect(resolveBookingSource('?src=https://example.com/?customer=123')).toBe('direct');
  });
});
