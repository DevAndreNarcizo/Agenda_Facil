-- Sprint 2: agregações que o navegador fazia baixando linhas em massa.
--
-- get_customer_stats: substitui `appointments?customer_id=in.(<todos os ids>)`, que estourava o
--   limite de URL com milhares de clientes e transferia um agendamento por linha.
-- get_booking_source_counts: substitui a paginação de TODOS os agendamentos só para contar canais.
--
-- Ambas são SECURITY INVOKER (o RLS de appointments continua valendo) e escopadas pela organização
-- do usuário autenticado; não recebem identificador de tenant.
--
-- @author André Narcizo - andre.narcizo@sysout.com.br

/**
 * Última visita e total de agendamentos ativos (não cancelados) por cliente.
 */
CREATE OR REPLACE FUNCTION public.get_customer_stats()
RETURNS TABLE (customer_id uuid, last_appointment timestamptz, total_appointments bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT a.customer_id, MAX(a.start_time), COUNT(*)::bigint
  FROM public.appointments a
  WHERE a.organization_id = (SELECT private.current_organization_id())
    AND a.customer_id IS NOT NULL
    AND a.status <> 'cancelled'
  GROUP BY a.customer_id;
$$;

/**
 * Quantidade de reservas por canal de origem (booking_source).
 */
CREATE OR REPLACE FUNCTION public.get_booking_source_counts()
RETURNS TABLE (booking_source text, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT a.booking_source, COUNT(*)::bigint
  FROM public.appointments a
  WHERE a.organization_id = (SELECT private.current_organization_id())
  GROUP BY a.booking_source;
$$;

REVOKE ALL ON FUNCTION public.get_customer_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_booking_source_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_source_counts() TO authenticated;
