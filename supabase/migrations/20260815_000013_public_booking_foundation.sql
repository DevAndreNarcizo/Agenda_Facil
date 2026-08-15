-- Estabelece configurações e comandos seguros para reserva pública por slug.
-- @author André Narcizo

CREATE TABLE IF NOT EXISTS public.public_booking_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  allowed_service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  allowed_employee_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(allowed_service_ids) <= 100),
  CHECK (cardinality(allowed_employee_ids) <= 100)
);

ALTER TABLE public.public_booking_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_booking_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.public_booking_settings TO authenticated;

CREATE POLICY public_booking_settings_owner_admin_only ON public.public_booking_settings
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT private.current_organization_id())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id = (SELECT private.current_organization_id())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.role IN ('owner', 'admin')
    )
  );

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'direct';

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_booking_source_valid;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_booking_source_valid
  CHECK (booking_source IN ('direct', 'instagram', 'google', 'qr', 'site', 'referral'));

CREATE INDEX IF NOT EXISTS idx_appointments_organization_source_start
  ON public.appointments (organization_id, booking_source, start_time DESC);

/**
 * Obtém o contexto mínimo de uma organização com reserva pública ativa.
 *
 * @author André Narcizo
 */
CREATE OR REPLACE FUNCTION public.get_public_booking_context(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization public.organizations%ROWTYPE;
  v_settings public.public_booking_settings%ROWTYPE;
BEGIN
  IF p_slug IS NULL OR lower(trim(p_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Reserva pública não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  SELECT organization.*
  INTO v_organization
  FROM public.organizations AS organization
  WHERE organization.slug = lower(trim(p_slug));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva pública não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  SELECT settings.*
  INTO v_settings
  FROM public.public_booking_settings AS settings
  WHERE settings.organization_id = v_organization.id
    AND settings.is_enabled;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva pública indisponível.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'organization', jsonb_build_object(
      'accentColor', v_organization.accent_color,
      'logoUrl', v_organization.logo_url,
      'name', v_organization.name,
      'primaryColor', v_organization.primary_color,
      'secondaryColor', v_organization.secondary_color,
      'slug', v_organization.slug
    ),
    'services', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'durationMinutes', service.duration_minutes,
        'id', service.id,
        'name', service.name,
        'price', service.price
      ) ORDER BY service.name)
      FROM public.services AS service
      WHERE service.organization_id = v_organization.id
        AND service.is_active
        AND service.id = ANY (v_settings.allowed_service_ids)
    ), '[]'::jsonb),
    'employees', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', employee.id,
        'name', employee.full_name,
        'photoUrl', coalesce(employee.photo_url, employee.avatar_url)
      ) ORDER BY employee.full_name)
      FROM public.profiles AS employee
      WHERE employee.organization_id = v_organization.id
        AND employee.role = 'employee'
        AND employee.id = ANY (v_settings.allowed_employee_ids)
    ), '[]'::jsonb)
  );
END;
$$;

/**
 * Retorna slots livres em uma data, sempre a partir de regras mantidas no banco.
 *
 * @author André Narcizo
 */
CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_allowed_service_ids uuid[];
  v_allowed_employee_ids uuid[];
  v_timezone text;
  v_duration_minutes integer;
  v_has_employees boolean;
  v_business_start time;
  v_business_end time;
  v_start timestamptz;
  v_end timestamptz;
  v_now_local_date date;
BEGIN
  IF p_slug IS NULL OR lower(trim(p_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_service_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'Parâmetros de disponibilidade inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT organization.id, settings.allowed_service_ids, settings.allowed_employee_ids
  INTO v_organization_id, v_allowed_service_ids, v_allowed_employee_ids
  FROM public.organizations AS organization
  JOIN public.public_booking_settings AS settings
    ON settings.organization_id = organization.id
   AND settings.is_enabled
  WHERE organization.slug = lower(trim(p_slug));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva pública indisponível.' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(settings.timezone, 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.organization_settings AS settings
  WHERE settings.organization_id = v_organization_id;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_now_local_date := (now() AT TIME ZONE v_timezone)::date;

  IF p_date < v_now_local_date OR p_date > v_now_local_date + 90 THEN
    RAISE EXCEPTION 'Data fora do período permitido.' USING ERRCODE = '22023';
  END IF;

  SELECT service.duration_minutes
  INTO v_duration_minutes
  FROM public.services AS service
  WHERE service.id = p_service_id
    AND service.organization_id = v_organization_id
    AND service.is_active
    AND service.id = ANY (v_allowed_service_ids);

  IF v_duration_minutes IS NULL THEN
    RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS employee
    WHERE employee.organization_id = v_organization_id
      AND employee.role = 'employee'
  ) INTO v_has_employees;

  IF v_has_employees AND p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Profissional obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = v_organization_id
      AND employee.role = 'employee'
      AND employee.id = ANY (v_allowed_employee_ids)
  ) THEN
    RAISE EXCEPTION 'Profissional indisponível.' USING ERRCODE = 'P0001';
  END IF;

  SELECT business_hours.start_time, business_hours.end_time
  INTO v_business_start, v_business_end
  FROM public.organization_business_hours AS business_hours
  WHERE business_hours.organization_id = v_organization_id
    AND business_hours.day_of_week = extract(isodow FROM p_date)::smallint - 1
    AND business_hours.is_active;

  IF v_business_start IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_start := (p_date + v_business_start) AT TIME ZONE v_timezone;
  v_end := (p_date + v_business_end) AT TIME ZONE v_timezone;

  RETURN coalesce((
    SELECT jsonb_agg(slot.start_time ORDER BY slot.start_time)
    FROM (
      SELECT candidate.start_time
      FROM generate_series(
        v_start,
        v_end - make_interval(mins => v_duration_minutes),
        interval '30 minutes'
      ) AS candidate(start_time)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.appointments AS appointment
        WHERE appointment.organization_id = v_organization_id
          AND appointment.status IN ('pending', 'confirmed')
          AND tstzrange(appointment.start_time, appointment.end_time, '[)')
            && tstzrange(
              candidate.start_time,
              candidate.start_time + make_interval(mins => v_duration_minutes),
              '[)'
            )
          AND (
            (p_employee_id IS NULL AND appointment.employee_id IS NULL)
            OR (p_employee_id IS NOT NULL AND appointment.employee_id = p_employee_id)
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.appointment_blocks AS block
        WHERE block.organization_id = v_organization_id
          AND tstzrange(block.start_time, block.end_time, '[)')
            && tstzrange(
              candidate.start_time,
              candidate.start_time + make_interval(mins => v_duration_minutes),
              '[)'
            )
          AND (block.employee_id IS NULL OR block.employee_id = p_employee_id)
      )
    ) AS slot
  ), '[]'::jsonb);
END;
$$;

/**
 * Cria uma reserva pública após vincular obrigatoriamente slug e sessão do portal.
 *
 * @author André Narcizo
 */
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_session_id uuid,
  p_slug text,
  p_service_id uuid,
  p_start_time timestamptz,
  p_employee_id uuid DEFAULT NULL,
  p_source text DEFAULT 'direct'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.portal_sessions%ROWTYPE;
  v_organization_id uuid;
  v_allowed_service_ids uuid[];
  v_allowed_employee_ids uuid[];
  v_service public.services%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_timezone text;
  v_end_time timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_business_start time;
  v_business_end time;
  v_has_employees boolean;
  v_booking_source text;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR p_slug IS NULL OR p_service_id IS NULL OR p_start_time IS NULL
    OR lower(trim(p_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Dados de reserva inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT session.*
  INTO v_session
  FROM public.portal_sessions AS session
  WHERE session.id = p_session_id
    AND session.revoked_at IS NULL
    AND session.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  SELECT organization.id, settings.allowed_service_ids, settings.allowed_employee_ids
  INTO v_organization_id, v_allowed_service_ids, v_allowed_employee_ids
  FROM public.organizations AS organization
  JOIN public.public_booking_settings AS settings
    ON settings.organization_id = organization.id
   AND settings.is_enabled
  WHERE organization.slug = lower(trim(p_slug));

  IF NOT FOUND OR v_organization_id IS DISTINCT FROM v_session.organization_id THEN
    RAISE EXCEPTION 'Reserva pública indisponível.' USING ERRCODE = '42501';
  END IF;

  IF p_start_time <= now() OR p_start_time > now() + interval '90 days' THEN
    RAISE EXCEPTION 'Data fora do período permitido.' USING ERRCODE = '22023';
  END IF;

  SELECT service.*
  INTO v_service
  FROM public.services AS service
  WHERE service.id = p_service_id
    AND service.organization_id = v_organization_id
    AND service.is_active
    AND service.id = ANY (v_allowed_service_ids);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS employee
    WHERE employee.organization_id = v_organization_id
      AND employee.role = 'employee'
  ) INTO v_has_employees;

  IF v_has_employees AND p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Profissional obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = v_organization_id
      AND employee.role = 'employee'
      AND employee.id = ANY (v_allowed_employee_ids)
  ) THEN
    RAISE EXCEPTION 'Profissional indisponível.' USING ERRCODE = 'P0001';
  END IF;

  SELECT customer.*
  INTO v_customer
  FROM public.customers AS customer
  WHERE customer.id = v_session.customer_id
    AND customer.organization_id = v_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(settings.timezone, 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.organization_settings AS settings
  WHERE settings.organization_id = v_organization_id;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_end_time := p_start_time + make_interval(mins => v_service.duration_minutes);
  v_local_start := p_start_time AT TIME ZONE v_timezone;
  v_local_end := v_end_time AT TIME ZONE v_timezone;

  IF v_local_start::date <> v_local_end::date THEN
    RAISE EXCEPTION 'O serviço não pode atravessar o dia operacional.' USING ERRCODE = '22023';
  END IF;

  SELECT business_hours.start_time, business_hours.end_time
  INTO v_business_start, v_business_end
  FROM public.organization_business_hours AS business_hours
  WHERE business_hours.organization_id = v_organization_id
    AND business_hours.day_of_week = extract(isodow FROM v_local_start)::smallint - 1
    AND business_hours.is_active;

  IF v_business_start IS NULL
    OR v_local_start::time < v_business_start
    OR v_local_end::time > v_business_end THEN
    RAISE EXCEPTION 'Horário fora do expediente configurado.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_blocks AS block
    WHERE block.organization_id = v_organization_id
      AND tstzrange(block.start_time, block.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
      AND (block.employee_id IS NULL OR block.employee_id = p_employee_id)
  ) THEN
    RAISE EXCEPTION 'Este horário está bloqueado.' USING ERRCODE = '23P01';
  END IF;

  v_booking_source := CASE lower(trim(coalesce(p_source, 'direct')))
    WHEN 'instagram' THEN 'instagram'
    WHEN 'google' THEN 'google'
    WHEN 'qr' THEN 'qr'
    WHEN 'site' THEN 'site'
    WHEN 'referral' THEN 'referral'
    ELSE 'direct'
  END;

  BEGIN
    INSERT INTO public.appointments (
      booking_source, customer_id, customer_name, customer_phone, employee_id,
      end_time, organization_id, service_id, start_time, status
    ) VALUES (
      v_booking_source, v_customer.id, v_customer.name, v_customer.phone, p_employee_id,
      v_end_time, v_organization_id, v_service.id, p_start_time, 'pending'
    ) RETURNING * INTO v_appointment;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Este horário não está disponível.' USING ERRCODE = '23P01';
  END;

  RETURN jsonb_build_object(
    'appointment', jsonb_build_object(
      'endTime', v_appointment.end_time,
      'id', v_appointment.id,
      'startTime', v_appointment.start_time,
      'status', v_appointment.status
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_booking_context(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_available_slots(text, uuid, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_public_booking(uuid, text, uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_booking_context(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_available_slots(text, uuid, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_public_booking(uuid, text, uuid, timestamptz, uuid, text) TO service_role;
