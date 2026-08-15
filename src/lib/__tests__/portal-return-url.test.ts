import { describe, expect, it } from 'vitest';
import { getPublicBookingReturnUrl, getPublicBookingSlug } from '@/lib/portal-return-url';

describe('getPublicBookingReturnUrl', () => {
  it('aceita apenas a rota interna pública de reserva', () => {
    expect(getPublicBookingReturnUrl('?returnTo=%2Freservar%2Fstudio-exemplo%3Fsrc%3Dqr')).toBe('/reservar/studio-exemplo?src=qr');
  });

  it('recusa redirecionamento externo e outras rotas internas', () => {
    expect(getPublicBookingReturnUrl('?returnTo=https%3A%2F%2Fevil.example')).toBeNull();
    expect(getPublicBookingReturnUrl('?returnTo=%2Fdashboard')).toBeNull();
  });

  it('extrai o slug somente da rota já aprovada', () => {
    expect(getPublicBookingSlug('/reservar/studio-exemplo?src=instagram')).toBe('studio-exemplo');
  });
});
