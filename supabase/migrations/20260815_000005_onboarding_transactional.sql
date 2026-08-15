-- Centraliza o onboarding em uma operação transacional idempotente.
-- @author André Narcizo

CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  specialty text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_business_hours (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active boolean NOT NULL DEFAULT false,
  start_time time NOT NULL,
  end_time time NOT NULL,
  PRIMARY KEY (organization_id, day_of_week),
  CHECK (end_time > start_time)
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

ALTER TABLE public.services
  ADD CONSTRAINT services_organization_name_unique UNIQUE (organization_id, name);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_settings_tenant_isolation ON public.organization_settings
  FOR ALL TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()));

CREATE POLICY organization_business_hours_tenant_isolation ON public.organization_business_hours
  FOR ALL TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()));

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_slug text := lower(trim(p_payload ->> 'slug'));
  v_business_name text := trim(p_payload ->> 'businessName');
  v_service_name text := trim(p_payload ->> 'serviceName');
BEGIN
  IF v_business_name = '' OR v_service_name = '' OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Dados de onboarding inválidos' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'schedule') <> 'array' OR jsonb_array_length(p_payload -> 'schedule') <> 7 THEN
    RAISE EXCEPTION 'Horários inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id INTO v_organization_id
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_organization_id IS NULL THEN
    INSERT INTO public.organizations (name, owner_id, slug)
    VALUES (v_business_name, p_user_id, v_slug)
    RETURNING id INTO v_organization_id;

    UPDATE public.profiles
    SET organization_id = v_organization_id, role = 'owner', updated_at = now()
    WHERE id = p_user_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug AND id <> v_organization_id) THEN
      RAISE EXCEPTION 'Slug indisponível' USING ERRCODE = '23505';
    END IF;

    UPDATE public.organizations
    SET name = v_business_name, slug = v_slug, owner_id = p_user_id, updated_at = now()
    WHERE id = v_organization_id;
  END IF;

  INSERT INTO public.organization_settings (address, bio, instagram, organization_id, specialty, timezone, updated_at)
  VALUES (
    jsonb_build_object('address', p_payload ->> 'address', 'cep', p_payload ->> 'cep', 'city', p_payload ->> 'city', 'number', p_payload ->> 'number', 'state', p_payload ->> 'state'),
    coalesce(p_payload ->> 'bio', ''), coalesce(p_payload ->> 'instagram', ''), v_organization_id,
    coalesce(p_payload ->> 'specialty', ''), 'America/Sao_Paulo', now()
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET address = EXCLUDED.address, bio = EXCLUDED.bio, instagram = EXCLUDED.instagram,
      specialty = EXCLUDED.specialty, timezone = EXCLUDED.timezone, updated_at = now();

  DELETE FROM public.organization_business_hours WHERE organization_id = v_organization_id;
  INSERT INTO public.organization_business_hours (day_of_week, end_time, is_active, organization_id, start_time)
  SELECT (entry ->> 'dayOfWeek')::smallint, (entry ->> 'end')::time, coalesce((entry ->> 'active')::boolean, false), v_organization_id, (entry ->> 'start')::time
  FROM jsonb_array_elements(p_payload -> 'schedule') AS entry;

  INSERT INTO public.services (category, duration_minutes, name, organization_id, price)
  VALUES (coalesce(nullif(p_payload ->> 'serviceCategory', ''), 'Geral'), (p_payload ->> 'serviceDuration')::integer, v_service_name, v_organization_id, (p_payload ->> 'servicePrice')::numeric)
  ON CONFLICT (organization_id, name) DO UPDATE
  SET category = EXCLUDED.category, duration_minutes = EXCLUDED.duration_minutes, price = EXCLUDED.price;

  UPDATE public.organizations SET onboarding_completed_at = now() WHERE id = v_organization_id;
  RETURN v_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid, jsonb) TO service_role;
