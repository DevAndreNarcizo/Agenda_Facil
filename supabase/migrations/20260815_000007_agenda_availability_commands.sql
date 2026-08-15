-- Centraliza disponibilidade, bloqueios e comandos críticos da agenda.
-- @author André Narcizo

CREATE INDEX IF NOT EXISTS idx_appointment_blocks_organization_start
  ON public.appointment_blocks (organization_id, start_time);

ALTER TABLE public.appointment_blocks
  ADD CONSTRAINT appointment_blocks_employee_time_no_overlap
  EXCLUDE USING gist (
    organization_id WITH =,
    employee_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (employee_id IS NOT NULL);

ALTER TABLE public.appointment_blocks
  ADD CONSTRAINT appointment_blocks_org_time_no_overlap_without_employee
  EXCLUDE USING gist (
    organization_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (employee_id IS NULL);

DROP POLICY IF EXISTS appointments_tenant_isolation ON public.appointments;
CREATE POLICY appointments_select_tenant_isolation ON public.appointments
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));

DROP POLICY IF EXISTS appointment_blocks_tenant_isolation ON public.appointment_blocks;
CREATE POLICY appointment_blocks_select_tenant_isolation ON public.appointment_blocks
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.appointments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.appointment_blocks FROM authenticated;

CREATE OR REPLACE FUNCTION public.manage_appointment_command(
  p_actor_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text := p_payload ->> 'action';
  v_actor_role text;
  v_organization_id uuid;
  v_timezone text;
  v_appointment public.appointments%ROWTYPE;
  v_block public.appointment_blocks%ROWTYPE;
  v_appointment_id uuid;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_service_id uuid;
  v_employee_id uuid;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_duration_minutes integer;
  v_target_status text;
  v_reason text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_business_start time;
  v_business_end time;
  v_has_employees boolean;
BEGIN
  SELECT profile.organization_id, profile.role
  INTO v_organization_id, v_actor_role
  FROM public.profiles AS profile
  WHERE profile.id = p_actor_id;

  IF v_organization_id IS NULL OR v_actor_role NOT IN ('owner', 'admin', 'employee') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar agendamentos.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_organization_id::text, 0));

  IF v_action IN ('create', 'reschedule') THEN
    BEGIN
      v_service_id := (p_payload ->> 'serviceId')::uuid;
      v_start_time := (p_payload ->> 'startTime')::timestamptz;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Serviço ou horário inválido.' USING ERRCODE = '22023';
    END;

    IF v_service_id IS NULL OR v_start_time IS NULL THEN
      RAISE EXCEPTION 'Serviço e horário inicial são obrigatórios.' USING ERRCODE = '22023';
    END IF;

    SELECT service.duration_minutes
    INTO v_duration_minutes
    FROM public.services AS service
    WHERE service.id = v_service_id
      AND service.organization_id = v_organization_id
      AND coalesce(service.is_active, true);

    IF v_duration_minutes IS NULL THEN
      RAISE EXCEPTION 'Serviço não encontrado ou inativo.' USING ERRCODE = 'P0001';
    END IF;

    v_end_time := v_start_time + make_interval(mins => v_duration_minutes);

    SELECT settings.timezone
    INTO v_timezone
    FROM public.organization_settings AS settings
    WHERE settings.organization_id = v_organization_id;

    v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
    v_local_start := v_start_time AT TIME ZONE v_timezone;
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

    BEGIN
      v_employee_id := nullif(p_payload ->> 'employeeId', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Profissional inválido.' USING ERRCODE = '22023';
    END;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles AS employee
      WHERE employee.organization_id = v_organization_id
        AND employee.role = 'employee'
    )
    INTO v_has_employees;

    IF v_has_employees AND v_employee_id IS NULL THEN
      RAISE EXCEPTION 'Profissional é obrigatório para organizações com equipe.' USING ERRCODE = '22023';
    END IF;

    IF v_employee_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS employee
      WHERE employee.id = v_employee_id
        AND employee.organization_id = v_organization_id
    ) THEN
      RAISE EXCEPTION 'Profissional não pertence à organização.' USING ERRCODE = '22023';
    END IF;

    IF v_actor_role = 'employee' AND v_employee_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'Funcionários só podem gerenciar horários próprios.' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.appointment_blocks AS block
      WHERE block.organization_id = v_organization_id
        AND tstzrange(block.start_time, block.end_time, '[)') && tstzrange(v_start_time, v_end_time, '[)')
        AND (block.employee_id IS NULL OR v_employee_id IS NULL OR block.employee_id = v_employee_id)
    ) THEN
      RAISE EXCEPTION 'Este horário está bloqueado.' USING ERRCODE = '23P01';
    END IF;

    IF v_action = 'create' THEN
      BEGIN
        v_customer_id := nullif(p_payload ->> 'customerId', '')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Cliente inválido.' USING ERRCODE = '22023';
      END;

      IF v_customer_id IS NOT NULL THEN
        SELECT customer.name, customer.phone
        INTO v_customer_name, v_customer_phone
        FROM public.customers AS customer
        WHERE customer.id = v_customer_id
          AND customer.organization_id = v_organization_id;

        IF v_customer_name IS NULL THEN
          RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = 'P0001';
        END IF;
      ELSE
        v_customer_name := nullif(trim(p_payload ->> 'customerName'), '');
        v_customer_phone := nullif(trim(p_payload ->> 'customerPhone'), '');
        IF v_customer_name IS NULL THEN
          RAISE EXCEPTION 'Nome do cliente é obrigatório.' USING ERRCODE = '22023';
        END IF;
      END IF;

      INSERT INTO public.appointments (
        customer_id, customer_name, customer_phone, employee_id, end_time, notes,
        organization_id, service_id, start_time, status
      )
      VALUES (
        v_customer_id, v_customer_name, v_customer_phone, v_employee_id, v_end_time,
        nullif(trim(p_payload ->> 'notes'), ''), v_organization_id, v_service_id,
        v_start_time, 'pending'
      )
      RETURNING * INTO v_appointment;
    ELSE
      BEGIN
        v_appointment_id := (p_payload ->> 'appointmentId')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Agendamento inválido.' USING ERRCODE = '22023';
      END;

      SELECT * INTO v_appointment
      FROM public.appointments
      WHERE id = v_appointment_id
        AND organization_id = v_organization_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0001';
      END IF;
      IF v_appointment.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Somente agendamentos ativos podem ser reagendados.' USING ERRCODE = '22023';
      END IF;
      IF v_actor_role = 'employee' AND v_appointment.employee_id IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Funcionários só podem gerenciar horários próprios.' USING ERRCODE = '42501';
      END IF;

      UPDATE public.appointments
      SET employee_id = v_employee_id,
          service_id = v_service_id,
          start_time = v_start_time,
          end_time = v_end_time
      WHERE id = v_appointment.id
      RETURNING * INTO v_appointment;
    END IF;

    RETURN jsonb_build_object('appointment', to_jsonb(v_appointment));
  END IF;

  IF v_action IN ('update-status', 'cancel') THEN
    BEGIN
      v_appointment_id := (p_payload ->> 'appointmentId')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Agendamento inválido.' USING ERRCODE = '22023';
    END;

    SELECT * INTO v_appointment
    FROM public.appointments
    WHERE id = v_appointment_id
      AND organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0001';
    END IF;
    IF v_actor_role = 'employee' AND v_appointment.employee_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'Funcionários só podem gerenciar horários próprios.' USING ERRCODE = '42501';
    END IF;

    v_target_status := CASE WHEN v_action = 'cancel' THEN 'cancelled' ELSE p_payload ->> 'status' END;
    IF (v_appointment.status = 'pending' AND v_target_status NOT IN ('confirmed', 'cancelled'))
      OR (v_appointment.status = 'confirmed' AND v_target_status NOT IN ('completed', 'cancelled'))
      OR v_appointment.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'Transição de status não permitida.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.appointments
    SET status = v_target_status
    WHERE id = v_appointment.id
    RETURNING * INTO v_appointment;

    RETURN jsonb_build_object('appointment', to_jsonb(v_appointment));
  END IF;

  IF v_action = 'create-block' THEN
    IF v_actor_role = 'employee' THEN
      BEGIN
        v_employee_id := nullif(p_payload ->> 'employeeId', '')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Profissional inválido.' USING ERRCODE = '22023';
      END;
      IF v_employee_id IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Funcionários só podem bloquear horários próprios.' USING ERRCODE = '42501';
      END IF;
    ELSE
      BEGIN
        v_employee_id := nullif(p_payload ->> 'employeeId', '')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Profissional inválido.' USING ERRCODE = '22023';
      END;
    END IF;

    BEGIN
      v_start_time := (p_payload ->> 'startTime')::timestamptz;
      v_end_time := (p_payload ->> 'endTime')::timestamptz;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Intervalo de bloqueio inválido.' USING ERRCODE = '22023';
    END;
    IF v_start_time IS NULL OR v_end_time IS NULL OR v_end_time <= v_start_time THEN
      RAISE EXCEPTION 'Intervalo de bloqueio inválido.' USING ERRCODE = '22023';
    END IF;

    IF v_employee_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS employee
      WHERE employee.id = v_employee_id
        AND employee.organization_id = v_organization_id
    ) THEN
      RAISE EXCEPTION 'Profissional não pertence à organização.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.appointments AS appointment
      WHERE appointment.organization_id = v_organization_id
        AND appointment.status IN ('pending', 'confirmed')
        AND tstzrange(appointment.start_time, appointment.end_time, '[)') && tstzrange(v_start_time, v_end_time, '[)')
        AND (appointment.employee_id IS NULL OR v_employee_id IS NULL OR appointment.employee_id = v_employee_id)
    ) THEN
      RAISE EXCEPTION 'Há agendamento ativo neste intervalo.' USING ERRCODE = '23P01';
    END IF;

    INSERT INTO public.appointment_blocks (employee_id, end_time, organization_id, reason, start_time)
    VALUES (v_employee_id, v_end_time, v_organization_id, nullif(trim(p_payload ->> 'reason'), ''), v_start_time)
    RETURNING * INTO v_block;

    RETURN jsonb_build_object('block', to_jsonb(v_block));
  END IF;

  IF v_action = 'delete-block' THEN
    BEGIN
      v_appointment_id := (p_payload ->> 'blockId')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Bloqueio inválido.' USING ERRCODE = '22023';
    END;

    SELECT * INTO v_block
    FROM public.appointment_blocks
    WHERE id = v_appointment_id
      AND organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bloqueio não encontrado.' USING ERRCODE = 'P0001';
    END IF;
    IF v_actor_role = 'employee' AND v_block.employee_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'Funcionários só podem remover bloqueios próprios.' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.appointment_blocks WHERE id = v_block.id;
    RETURN jsonb_build_object('deletedBlockId', v_block.id);
  END IF;

  RAISE EXCEPTION 'Ação de agenda inválida.' USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.manage_appointment_command(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_appointment_command(uuid, jsonb) TO service_role;
