-- Sprint 1 do painel refinado: permissões de escrita por papel e analytics versionado.
--
-- 1. organizations/profiles não tinham políticas de UPDATE/DELETE: o painel recebia "sucesso"
--    com 0 linhas afetadas. Agora owner/admin editam colunas explicitamente liberadas.
-- 2. services, customers, organization_settings e organization_business_hours aceitavam escrita
--    de qualquer membro. Catálogo, horários e dados do negócio passam a exigir owner/admin.
-- 3. As RPCs de analytics existiam fora das migrations (SQL legado com parâmetro de organização
--    em SECURITY DEFINER). São recriadas como SECURITY INVOKER, sem parâmetro de tenant,
--    sempre escopadas por private.current_organization_id() e pelo RLS.
--
-- @author André Narcizo - andre.narcizo@sysout.com.br

-- ---------------------------------------------------------------------------
-- Helpers de papel
-- ---------------------------------------------------------------------------

/**
 * Papel do usuário autenticado na própria organização (NULL se sem perfil).
 * SECURITY DEFINER evita recursão de RLS ao ser usado em políticas de profiles.
 */
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

/**
 * Verdadeiro quando o usuário autenticado é owner ou admin da organização atual.
 */
CREATE OR REPLACE FUNCTION private.is_organization_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT role IN ('owner', 'admin') FROM public.profiles WHERE id = (SELECT auth.uid())), false);
$$;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_organization_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_organization_manager() TO authenticated;

-- ---------------------------------------------------------------------------
-- organizations: identidade editável por owner/admin; plano e Stripe só pelo servidor
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON TABLE public.organizations FROM authenticated;
GRANT UPDATE (name, slug, logo_url, primary_color, secondary_color, accent_color, updated_at)
  ON TABLE public.organizations TO authenticated;

DROP POLICY IF EXISTS organizations_update_managers ON public.organizations;
CREATE POLICY organizations_update_managers ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()))
  WITH CHECK (id = (SELECT private.current_organization_id()));

-- ---------------------------------------------------------------------------
-- profiles: gestão da equipe por owner/admin; ninguém promove a owner nem altera o próprio papel
-- ---------------------------------------------------------------------------

REVOKE UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, role, phone, avatar_url, photo_url, updated_at) ON TABLE public.profiles TO authenticated;
GRANT DELETE ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_update_by_managers ON public.profiles;
CREATE POLICY profiles_update_by_managers ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.is_organization_manager())
    AND id <> (SELECT auth.uid())
    AND role <> 'owner'
  )
  -- Políticas permissivas se combinam com OR: o CHECK repete "id <> auth.uid()" para que
  -- o próprio usuário não use esta política para validar a troca do próprio papel.
  WITH CHECK (
    organization_id = (SELECT private.current_organization_id())
    AND id <> (SELECT auth.uid())
    AND role IN ('admin', 'employee', 'staff')
  );

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()) AND role = (SELECT private.current_user_role()));

DROP POLICY IF EXISTS profiles_delete_by_managers ON public.profiles;
CREATE POLICY profiles_delete_by_managers ON public.profiles
  FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.is_organization_manager())
    AND id <> (SELECT auth.uid())
    AND role <> 'owner'
  );

-- ---------------------------------------------------------------------------
-- services: leitura para a equipe; catálogo editável só por owner/admin
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS services_tenant_isolation ON public.services;
DROP POLICY IF EXISTS services_select_members ON public.services;
DROP POLICY IF EXISTS services_write_managers ON public.services;
CREATE POLICY services_select_members ON public.services
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));
CREATE POLICY services_write_managers ON public.services
  FOR ALL TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()));

-- ---------------------------------------------------------------------------
-- customers: toda a equipe cadastra e edita; exclusão só por owner/admin
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;
DROP POLICY IF EXISTS customers_select_members ON public.customers;
DROP POLICY IF EXISTS customers_insert_members ON public.customers;
DROP POLICY IF EXISTS customers_update_members ON public.customers;
DROP POLICY IF EXISTS customers_delete_managers ON public.customers;
CREATE POLICY customers_select_members ON public.customers
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));
CREATE POLICY customers_insert_members ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT private.current_organization_id()));
CREATE POLICY customers_update_members ON public.customers
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()));
CREATE POLICY customers_delete_managers ON public.customers
  FOR DELETE TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()));

-- ---------------------------------------------------------------------------
-- organization_settings / organization_business_hours: leitura da equipe, escrita de owner/admin
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS organization_settings_tenant_isolation ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_select_members ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_write_managers ON public.organization_settings;
CREATE POLICY organization_settings_select_members ON public.organization_settings
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));
CREATE POLICY organization_settings_write_managers ON public.organization_settings
  FOR ALL TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()));

DROP POLICY IF EXISTS organization_business_hours_tenant_isolation ON public.organization_business_hours;
DROP POLICY IF EXISTS organization_business_hours_select_members ON public.organization_business_hours;
DROP POLICY IF EXISTS organization_business_hours_write_managers ON public.organization_business_hours;
CREATE POLICY organization_business_hours_select_members ON public.organization_business_hours
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));
CREATE POLICY organization_business_hours_write_managers ON public.organization_business_hours
  FOR ALL TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.is_organization_manager()));

-- ---------------------------------------------------------------------------
-- Analytics: remove qualquer versão anterior (assinaturas desconhecidas fora das migrations)
-- ---------------------------------------------------------------------------

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_monthly_revenue', 'get_top_services', 'get_peak_hours', 'get_dashboard_stats', 'get_period_summary')
  LOOP
    EXECUTE format('DROP FUNCTION %s', fn.signature);
  END LOOP;
END $$;

/**
 * Receita realizada por mês (últimos 24 meses) no fuso operacional.
 * Usa o valor efetivamente pago e, na falta dele, o preço do serviço.
 */
CREATE FUNCTION public.get_monthly_revenue()
RETURNS TABLE (month text, revenue numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    to_char(a.start_time AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month,
    COALESCE(SUM(COALESCE(NULLIF(a.amount_paid, 0), s.price, 0)), 0)::numeric AS revenue
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.organization_id = (SELECT private.current_organization_id())
    AND a.status = 'completed'
    AND a.start_time >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' - interval '23 months'
  GROUP BY 1
  ORDER BY 1;
$$;

/**
 * Serviços mais realizados (concluídos ou confirmados), top 5.
 */
CREATE FUNCTION public.get_top_services()
RETURNS TABLE (service_name text, count bigint, revenue numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT s.name, COUNT(*)::bigint, COALESCE(SUM(s.price), 0)::numeric
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.organization_id = (SELECT private.current_organization_id())
    AND a.status IN ('completed', 'confirmed')
  GROUP BY s.name
  ORDER BY 2 DESC
  LIMIT 5;
$$;

/**
 * Distribuição de atendimentos por hora do dia (horário de Brasília).
 */
CREATE FUNCTION public.get_peak_hours()
RETURNS TABLE (hour text, appointments bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT to_char(a.start_time AT TIME ZONE 'America/Sao_Paulo', 'HH24:00'), COUNT(*)::bigint
  FROM public.appointments a
  WHERE a.organization_id = (SELECT private.current_organization_id())
    AND a.status IN ('completed', 'confirmed')
  GROUP BY 1
  ORDER BY 1;
$$;

/**
 * Indicadores gerais: atendimentos concluídos, clientes cadastrados, receita e ticket médio.
 */
CREATE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (total_appointments bigint, total_customers bigint, total_revenue numeric, avg_ticket numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH done AS (
    SELECT COALESCE(NULLIF(a.amount_paid, 0), s.price, 0) AS value
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.organization_id = (SELECT private.current_organization_id())
      AND a.status = 'completed'
  )
  SELECT
    (SELECT COUNT(*) FROM done)::bigint,
    (SELECT COUNT(*) FROM public.customers c WHERE c.organization_id = (SELECT private.current_organization_id()))::bigint,
    (SELECT COALESCE(SUM(value), 0) FROM done)::numeric,
    (SELECT COALESCE(ROUND(AVG(value), 2), 0) FROM done)::numeric;
$$;

/**
 * Resumo operacional de um intervalo [p_start, p_end): substitui contagens feitas no navegador
 * sobre listas paginadas (que paravam em 100 registros).
 */
CREATE FUNCTION public.get_period_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE (total bigint, pending bigint, completed bigint, booked_minutes bigint, paid_revenue numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE a.status = 'pending')::bigint,
    COUNT(*) FILTER (WHERE a.status = 'completed')::bigint,
    COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60), 0)::bigint,
    COALESCE(SUM(COALESCE(NULLIF(a.amount_paid, 0), s.price, 0)) FILTER (WHERE a.payment_status = 'paid'), 0)::numeric
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.organization_id = (SELECT private.current_organization_id())
    AND a.status <> 'cancelled'
    AND a.start_time >= p_start
    AND a.start_time < p_end;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_revenue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_services() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_peak_hours() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_period_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_services() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_peak_hours() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_period_summary(timestamptz, timestamptz) TO authenticated;
