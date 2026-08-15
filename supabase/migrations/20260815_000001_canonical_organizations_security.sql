-- Agenda Fácil: baseline canônico de multitenancy e segurança.
-- PRÉ-REQUISITO: execute somente após backup e validação em staging.
-- Este projeto usa public.organizations / organization_id; não aplique scripts legados company_id.

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Schema incompatível: organizations e profiles são obrigatórias.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_organization_start ON public.appointments (organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_customers_organization_name ON public.customers (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_services_organization_name ON public.services (organization_id, name);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_organization_id() TO authenticated;

-- Remove apenas políticas das tabelas canônicas. A função evita recursão em profiles.
DO $$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('organizations', 'profiles', 'customers', 'services', 'appointments', 'webhook_events')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  END LOOP;
END $$;

CREATE POLICY profiles_select_same_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR organization_id = private.current_organization_id());

CREATE POLICY profiles_insert_self_without_organization ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND organization_id IS NULL);

CREATE POLICY organizations_select_current ON public.organizations
  FOR SELECT TO authenticated
  USING (id = private.current_organization_id());

CREATE POLICY customers_tenant_isolation ON public.customers
  FOR ALL TO authenticated
  USING (organization_id = private.current_organization_id())
  WITH CHECK (organization_id = private.current_organization_id());

CREATE POLICY services_tenant_isolation ON public.services
  FOR ALL TO authenticated
  USING (organization_id = private.current_organization_id())
  WITH CHECK (organization_id = private.current_organization_id());

CREATE POLICY appointments_tenant_isolation ON public.appointments
  FOR ALL TO authenticated
  USING (organization_id = private.current_organization_id())
  WITH CHECK (organization_id = private.current_organization_id());

-- Eventos de webhook são exclusivamente do service role; nenhum cliente lê ou altera o ledger.
CREATE POLICY webhook_events_service_role_only ON public.webhook_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.webhook_events FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.current_organization_id();

-- Contratos mínimos de integridade sem assumir colunas inexistentes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_valid_time_range') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_valid_time_range CHECK (end_time > start_time);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_positive_duration') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_positive_duration CHECK (duration_minutes > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_non_negative_price') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_non_negative_price CHECK (price >= 0);
  END IF;
END $$;
