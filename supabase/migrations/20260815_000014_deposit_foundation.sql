-- Fundação mínima de sinal de reserva e expiração de pendências da SPEC-008.
-- @author André Narcizo

CREATE TABLE public.deposit_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid NULL,
  is_active boolean NOT NULL DEFAULT true,
  deposit_type text NOT NULL,
  deposit_value numeric(12, 2) NOT NULL,
  minimum_notice_minutes integer NOT NULL DEFAULT 0,
  cancellation_window_minutes integer NOT NULL DEFAULT 0,
  payment_window_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deposit_policies_deposit_type_valid
    CHECK (deposit_type IN ('fixed', 'percentage')),
  CONSTRAINT deposit_policies_deposit_value_valid
    CHECK (
      (deposit_type = 'fixed' AND deposit_value > 0)
      OR (deposit_type = 'percentage' AND deposit_value > 0 AND deposit_value <= 100)
    ),
  CONSTRAINT deposit_policies_minimum_notice_valid CHECK (minimum_notice_minutes >= 0),
  CONSTRAINT deposit_policies_cancellation_window_valid CHECK (cancellation_window_minutes >= 0),
  CONSTRAINT deposit_policies_payment_window_valid
    CHECK (payment_window_minutes BETWEEN 1 AND 10080)
);

ALTER TABLE public.services
  ADD CONSTRAINT services_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE public.deposit_policies
  ADD CONSTRAINT deposit_policies_service_organization_fkey
  FOREIGN KEY (service_id, organization_id)
  REFERENCES public.services (id, organization_id)
  ON DELETE CASCADE;

CREATE UNIQUE INDEX deposit_policies_default_organization_unique
  ON public.deposit_policies (organization_id)
  WHERE service_id IS NULL;

CREATE UNIQUE INDEX deposit_policies_service_organization_unique
  ON public.deposit_policies (organization_id, service_id)
  WHERE service_id IS NOT NULL;

CREATE TABLE public.appointment_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  policy_id uuid NULL REFERENCES public.deposit_policies(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'BRL' CHECK (currency = upper(currency)),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  paid_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_deposits_status_valid
    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refunded')),
  CONSTRAINT appointment_deposits_paid_at_valid
    CHECK (
      (status IN ('paid', 'refunded') AND paid_at IS NOT NULL)
      OR (status NOT IN ('paid', 'refunded') AND paid_at IS NULL)
    ),
  CONSTRAINT appointment_deposits_appointment_organization_unique
    UNIQUE (appointment_id, organization_id),
  CONSTRAINT appointment_deposits_appointment_organization_fkey
    FOREIGN KEY (appointment_id, organization_id)
    REFERENCES public.appointments (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX appointment_deposits_pending_expiration_idx
  ON public.appointment_deposits (expires_at)
  WHERE status = 'pending';

CREATE INDEX appointment_deposits_organization_created_idx
  ON public.appointment_deposits (organization_id, created_at DESC);

ALTER TABLE public.deposit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_deposits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.deposit_policies FROM anon, authenticated;
REVOKE ALL ON TABLE public.appointment_deposits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.deposit_policies TO authenticated;
GRANT SELECT ON TABLE public.appointment_deposits TO authenticated;

CREATE POLICY deposit_policies_owner_admin_only ON public.deposit_policies
  FOR ALL TO authenticated
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
  );

CREATE POLICY appointment_deposits_tenant_select ON public.appointment_deposits
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));

/**
 * Cria um sinal pendente a partir da política vigente e do preço do serviço no banco.
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
  v_expires_at timestamptz;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento obrigatório.' USING ERRCODE = '22023';
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

  IF v_appointment.organization_id IS DISTINCT FROM (SELECT private.current_organization_id()) THEN
    RAISE EXCEPTION 'Sem permissão para criar sinal deste agendamento.' USING ERRCODE = '42501';
  END IF;

  IF v_appointment.status NOT IN ('pending', 'confirmed') OR v_appointment.start_time <= now() THEN
    RAISE EXCEPTION 'Agendamento não está elegível para sinal.' USING ERRCODE = '22023';
  END IF;

  SELECT deposit.*
  INTO v_existing_deposit
  FROM public.appointment_deposits AS deposit
  WHERE deposit.appointment_id = v_appointment.id
    AND deposit.organization_id = v_appointment.organization_id;

  IF FOUND THEN
    RETURN v_existing_deposit;
  END IF;

  SELECT policy.*
  INTO v_policy
  FROM public.deposit_policies AS policy
  WHERE policy.organization_id = v_appointment.organization_id
    AND policy.is_active
    AND (policy.service_id IS NULL OR policy.service_id = v_appointment.service_id)
  ORDER BY (policy.service_id IS NOT NULL) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há política de sinal ativa para este agendamento.' USING ERRCODE = 'P0001';
  END IF;

  IF v_policy.deposit_type = 'percentage' THEN
    SELECT service.price
    INTO v_service_price
    FROM public.services AS service
    WHERE service.id = v_appointment.service_id
      AND service.organization_id = v_appointment.organization_id;

    IF v_service_price IS NULL THEN
      RAISE EXCEPTION 'Serviço do agendamento não permite calcular sinal percentual.' USING ERRCODE = '22023';
    END IF;

    v_amount := round(v_service_price * v_policy.deposit_value / 100, 2);
  ELSE
    v_amount := v_policy.deposit_value;
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor de sinal inválido.' USING ERRCODE = '22023';
  END IF;

  v_expires_at := least(
    now() + make_interval(mins => v_policy.payment_window_minutes),
    v_appointment.start_time
  );

  IF v_expires_at <= now() THEN
    RAISE EXCEPTION 'Janela de pagamento expirada.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.appointment_deposits (
    amount,
    appointment_id,
    expires_at,
    organization_id,
    policy_id
  )
  VALUES (
    v_amount,
    v_appointment.id,
    v_expires_at,
    v_appointment.organization_id,
    v_policy.id
  )
  RETURNING * INTO v_existing_deposit;

  RETURN v_existing_deposit;
END;
$$;

/**
 * Expira sinais pendentes vencidos e libera agendamentos ainda pendentes.
 *
 * @author André Narcizo
 */
CREATE OR REPLACE FUNCTION public.expire_pending_appointment_deposits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  WITH expired_deposits AS (
    UPDATE public.appointment_deposits AS deposit
    SET status = 'expired',
        updated_at = now()
    WHERE deposit.status = 'pending'
      AND deposit.expires_at <= now()
    RETURNING deposit.appointment_id, deposit.organization_id
  ),
  cancelled_appointments AS (
    UPDATE public.appointments AS appointment
    SET status = 'cancelled'
    FROM expired_deposits AS expired
    WHERE appointment.id = expired.appointment_id
      AND appointment.organization_id = expired.organization_id
      AND appointment.status = 'pending'
  )
  SELECT count(*)::integer
  INTO v_expired_count
  FROM expired_deposits;

  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_appointment_deposit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_pending_appointment_deposits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_pending_appointment_deposit(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.expire_pending_appointment_deposits() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_appointment_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_appointment_deposits() TO service_role;
