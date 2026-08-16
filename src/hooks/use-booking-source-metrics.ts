import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { bookingSources, type BookingSource } from '@/lib/public-booking-source';
import { supabase } from '@/lib/supabase';

const APPOINTMENTS_PAGE_SIZE = 1_000;

const bookingSourceLabels: Record<BookingSource, string> = {
  direct: 'Direto',
  google: 'Google',
  instagram: 'Instagram',
  qr: 'QR Code',
  referral: 'Indicação',
  site: 'Site / widget',
};

type BookingSourceRow = {
  booking_source: string | null;
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
 * Agrupa agendamentos por origem de aquisição para uso nas telas autenticadas.
 *
 * @author André Narcizo
 */
export function buildBookingSourceMetrics(rows: BookingSourceRow[]): BookingSourceMetric[] {
  const counts = new Map<BookingSource, number>(bookingSources.map((source) => [source, 0]));

  for (const row of rows) {
    const source = normalizeBookingSource(row.booking_source);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  const total = rows.length;
  return bookingSources.map((source) => ({
    count: counts.get(source) ?? 0,
    label: bookingSourceLabels[source],
    percentage: total === 0 ? 0 : Math.round(((counts.get(source) ?? 0) / total) * 100),
    source,
  }));
}

/**
 * Busca todos os canais da organização em páginas para não truncar métricas acima do limite padrão da API.
 *
 * @author André Narcizo
 */
async function getOrganizationBookingSources(organizationId: string): Promise<BookingSourceRow[]> {
  const rows: BookingSourceRow[] = [];
  let page = 0;

  while (true) {
    const start = page * APPOINTMENTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from('appointments')
      .select('booking_source')
      .eq('organization_id', organizationId)
      .order('id', { ascending: true })
      .range(start, start + APPOINTMENTS_PAGE_SIZE - 1);

    if (error) throw error;

    const currentPage = (data ?? []) as BookingSourceRow[];
    rows.push(...currentPage);
    if (currentPage.length < APPOINTMENTS_PAGE_SIZE) return rows;
    page += 1;
  }
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
    queryFn: async () => buildBookingSourceMetrics(await getOrganizationBookingSources(organizationId as string)),
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
