import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { bookingSources, type BookingSource } from '@/lib/public-booking-source';
import { supabase } from '@/lib/supabase';

export const bookingSourceLabels: Record<BookingSource, string> = {
  direct: 'Direto',
  google: 'Google',
  instagram: 'Instagram',
  qr: 'QR Code',
  referral: 'Indicação',
  site: 'Site / widget',
};

/** Contagem agregada por canal (RPC get_booking_source_counts). */
type BookingSourceRow = {
  booking_source: string | null;
  total: number;
};

export type BookingSourceMetric = {
  count: number;
  label: string;
  percentage: number;
  source: BookingSource;
};

/**
 * Converte valores legados ou inválidos para a origem direta, mantendo a visualização resiliente.
 *
 * @author André Narcizo
 */
function normalizeBookingSource(value: string | null): BookingSource {
  return bookingSources.includes(value as BookingSource) ? value as BookingSource : 'direct';
}

/**
 * Consolida as contagens por canal (origens legadas/inválidas somam em "direto") e calcula a participação.
 *
 * @author André Narcizo
 */
export function buildBookingSourceMetrics(rows: BookingSourceRow[]): BookingSourceMetric[] {
  const counts = new Map<BookingSource, number>(bookingSources.map((source) => [source, 0]));

  for (const row of rows) {
    const source = normalizeBookingSource(row.booking_source);
    counts.set(source, (counts.get(source) ?? 0) + Number(row.total));
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return bookingSources.map((source) => ({
    count: counts.get(source) ?? 0,
    label: bookingSourceLabels[source],
    percentage: total === 0 ? 0 : Math.round(((counts.get(source) ?? 0) / total) * 100),
    source,
  }));
}

/**
 * Contagem por canal agregada no banco (antes: paginação de todos os agendamentos no navegador).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
async function getOrganizationBookingSources(): Promise<BookingSourceRow[]> {
  const { data, error } = await supabase.rpc('get_booking_source_counts');
  if (error) throw error;
  return (data ?? []) as BookingSourceRow[];
}

/**
 * Fornece métricas de origem a partir dos agendamentos que o membro autenticado já pode consultar via RLS.
 *
 * @author André Narcizo
 */
export function useBookingSourceMetrics() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const query = useQuery({
    enabled: Boolean(organizationId),
    queryFn: async () => buildBookingSourceMetrics(await getOrganizationBookingSources()),
    queryKey: ['booking-source-metrics', organizationId],
    staleTime: 60_000,
  });

  const metrics = query.data ?? buildBookingSourceMetrics([]);
  return {
    error: query.error instanceof Error ? query.error.message : null,
    isLoading: query.isLoading,
    metrics,
    totalBookings: metrics.reduce((total, metric) => total + metric.count, 0),
  };
}
