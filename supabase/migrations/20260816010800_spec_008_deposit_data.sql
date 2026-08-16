-- Implementa a camada de dados de sinal da SPEC-008.
-- @author André Narcizo

CREATE TABLE public.deposit_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  deposit_mode text NOT NULL,
  deposit_value numeric(12, 2) NOT NULL,
  expiration_minutes integer NOT NULL DEFAULT 30,
  cancellation_window_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deposit_policies_mode_valid
    CHECK (deposit_mode IN ('fixed', 'percentage')),
  CONSTRAINT deposit_policies_value_valid
    CHECK (
      deposit_value > 0
      AND (deposit_mode <> 'percentage' OR deposit_value <= 100)
    ),
  CONSTRAINT deposit_policies_expiration_valid
    CHECK (expiration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT deposit_policies_cancellation_window_valid
    CHECK (cancellation_window_minutes >= 0)
);

CREATE UNIQUE INDEX deposit_policies_default_organization_unique
  ON public.deposit_policies (organization_id)
  WHERE service_id IS NULL;

CREATE UNIQUE INDEX deposit_policies_service_organization_unique
  ON public.deposit_policies (organization_id, service_id)
  WHERE service_id IS NOT NULL;

CREATE TABLE public.appointment_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.deposit_policies(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_deposits_appointment_unique UNIQUE (appointment_id),
  CONSTRAINT appointment_deposits_amount_valid CHECK (amount > 0),
  CONSTRAINT appointment_deposits_status_valid
    CHECK (status IN ('pending', 'paid', 'expired', 'refunded')),
  CONSTRAINT appointment_deposits_expiration_valid CHECK (expires_at > created_at),
  CONSTRAINT appointment_deposits_paid_at_valid
    CHECK ((status IN ('paid', 'refunded')) = (paid_at IS NOT NULL)),
  CONSTRAINT appointment_deposits_expired_at_valid
    CHECK ((status = 'expired') = (expired_at IS NOT NULL))
);

CREATE INDEX appointment_deposits_pending_expiration_idx
  ON public.appointment_deposits (expires_at)
  WHERE status = 'pending';

CREATE INDEX appointment_deposits_organization_created_at_idx
  ON public.appointment_deposits (organization_id, created_at DESC);

ALTER TABLE public.deposit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_deposits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.deposit_policies FROM anon;
REVOKE ALL ON TABLE public.appointment_deposits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deposit_policies TO authenticated;
GRANT SELECT ON TABLE public.appointment_deposits TO authenticated;

CREATE POLICY deposit_policies_select_tenant ON public.deposit_policies
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));

CREATE POLICY deposit_policies_insert_owner_admin ON public.deposit_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT private.current_organization_id())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role IN ('owner', 'admin')
    )
    AND (
      service_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.services AS service
        WHERE service.id = deposit_policies.service_id
          AND service.organization_id = deposit_policies.organization_id
      )
    )
  );

CREATE POLICY deposit_policies_update_owner_admin ON public.deposit_policies
  FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT private.current_organization_id())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id = (SELECT private.current_organization_id())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role IN ('owner', 'admin')
    )
    AND (
      service_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.services AS service
        WHERE service.id = deposit_policies.service_id
          AND service.organization_id = deposit_policies.organization_id
      )
    )
  );

CREATE POLICY deposit_policies_delete_owner_admin ON public.deposit_policies
  FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT private.current_organization_id())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role IN ('owner', 'admin')
    )
  );

CREATE POLICY appointment_deposits_select_tenant ON public.appointment_deposits
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));

/**
 * Cria um sinal pendente, calculado exclusivamente com a política e o preço do serviço no banco.
 *
 * @author André Narcizo
 */
CREATE OR REPLACE FUNCTION public.create_pending_appointment_deposit(
  p_appointment_id uuid
)
RETURNS public.appointment_deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_existing_deposit public.appointment_deposits%ROWTYPE;
  v_policy public.deposit_policies%ROWTYPE;
  v_service_price numeric(12, 2);
  v_amount numeric(12, 2);
BEGIN
  IF p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento é obrigatório.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_appointment_id::text, 0));

  SELECT appointment.*
  INTO v_appointment
  FROM public.appointments AS appointment
  WHERE appointment.id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT deposit.*
  INTO v_existing_deposit
  FROM public.appointment_deposits AS deposit
  WHERE deposit.appointment_id = v_appointment.id;

  IF FOUND THEN
    RETURN v_existing_deposit;
  END IF;

  IF v_appointment.status <> 'pending' OR v_appointment.start_time <= now() THEN
    RAISE EXCEPTION 'Agendamento não é elegível para sinal.' USING ERRCODE = '22023';
  END IF;

  SELECT policy.*
  INTO v_policy
  FROM public.deposit_policies AS policy
  WHERE policy.organization_id = v_appointment.organization_id
    AND policy.is_enabled
    AND (policy.service_id = v_appointment.service_id OR policy.service_id IS NULL)
  ORDER BY (policy.service_id IS NULL), policy.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma política de sinal ativa para o agendamento.' USING ERRCODE = 'P0001';
  END IF;

  SELECT service.price
  INTO v_service_price
  FROM public.services AS service
  WHERE service.id = v_appointment.service_id
    AND service.organization_id = v_appointment.organization_id;

  IF v_service_price IS NULL THEN
    RAISE EXCEPTION 'Serviço do agendamento não encontrado.' USING ERRCODE = 'P0001';
  END IF;

  v_amount := CASE v_policy.deposit_mode
    WHEN 'percentage' THEN round(v_service_price * v_policy.deposit_value / 100, 2)
    ELSE least(v_policy.deposit_value, v_service_price)
  END;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'A política de sinal calculou valor inválido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.appointment_deposits (
    amount,
    appointment_id,
    expires_at,
    organization_id,
    policy_id
  ) VALUES (
    v_amount,
    v_appointment.id,
    now() + make_interval(mins => v_policy.expiration_minutes),
    v_appointment.organization_id,
    v_policy.id
  )
  RETURNING * INTO v_existing_deposit;

  RETURN v_existing_deposit;
END;
$$;

/**
 * Expira sinais pendentes e libera o horário de agendamentos ainda pendentes.
 *
 * @author André Narcizo
 */
CREATE OR REPLACE FUNCTION public.expire_pending_appointment_deposits(
  p_limit integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deposit record;
  v_expired_appointment_id uuid;
  v_expired_count integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Limite de expiração inválido.' USING ERRCODE = '22023';
  END IF;

  FOR v_deposit IN
    SELECT deposit.id, deposit.appointment_id
    FROM public.appointment_deposits AS deposit
    WHERE deposit.status = 'pending'
      AND deposit.expires_at <= now()
    ORDER BY deposit.expires_at
    LIMIT p_limit
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_deposit.appointment_id::text, 0));

    UPDATE public.appointment_deposits AS deposit
    SET
      status = 'expired',
      expired_at = now(),
      updated_at = now()
    WHERE deposit.id = v_deposit.id
      AND deposit.status = 'pending'
      AND deposit.expires_at <= now()
    RETURNING deposit.appointment_id INTO v_expired_appointment_id;

    IF FOUND THEN
      UPDATE public.appointments AS appointment
      SET status = 'cancelled'
      WHERE appointment.id = v_expired_appointment_id
        AND appointment.status = 'pending';

      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_appointment_deposit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_pending_appointment_deposits(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_appointment_deposit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_appointment_deposits(integer) TO service_role;
