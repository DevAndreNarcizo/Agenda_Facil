export const bookingSources = ['direct', 'instagram', 'google', 'qr', 'site', 'referral'] as const;
export type BookingSource = (typeof bookingSources)[number];

/**
 * Resolve uma origem de aquisição sem persistir parâmetros arbitrários do navegador.
 *
 * @author André Narcizo
 */
export function resolveBookingSource(search: string): BookingSource {
  const params = new URLSearchParams(search);
  const rawSource = (params.get('src') ?? params.get('utm_source') ?? '').trim().toLowerCase();
  return bookingSources.includes(rawSource as BookingSource) ? rawSource as BookingSource : 'direct';
}
