-- Teste transacional da disponibilidade operacional da SPEC-004.
-- Execute somente no Supabase de teste com role administrativa.
-- @author André Narcizo

BEGIN;

INSERT INTO public.organizations (id, name, slug)
VALUES ('30000000-0000-4000-8000-000000000001', 'Agenda operacional teste', 'agenda-operacional-teste');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '31000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'owner@agenda.test', 'not-used-in-test', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner Agenda"}'::jsonb, now(), now()
  ),
  (
    '31000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'employee@agenda.test', 'not-used-in-test', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Profissional Agenda"}'::jsonb, now(), now()
  );

UPDATE public.profiles
SET organization_id = '30000000-0000-4000-8000-000000000001',
    role = 'owner'
WHERE id = '31000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET organization_id = '30000000-0000-4000-8000-000000000001',
    role = 'employee'
WHERE id = '31000000-0000-4000-8000-000000000002';

INSERT INTO public.organization_settings (organization_id, timezone)
VALUES ('30000000-0000-4000-8000-000000000001', 'America/Sao_Paulo');

INSERT INTO public.organization_business_hours (organization_id, day_of_week, is_active, start_time, end_time)
VALUES ('30000000-0000-4000-8000-000000000001', 0, true, '08:00', '18:00');

INSERT INTO public.services (id, duration_minutes, is_active, name, organization_id, price)
VALUES ('32000000-0000-4000-8000-000000000001', 30, true, 'Serviço operacional', '30000000-0000-4000-8000-000000000001', 50);

DO $$
DECLARE
  v_first jsonb;
  v_first_id uuid;
  v_second jsonb;
  v_direct_write_blocked boolean := false;
BEGIN
  v_first := public.manage_appointment_command(
    '31000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'action', 'create',
      'customerName', 'Cliente de teste',
      'employeeId', '31000000-0000-4000-8000-000000000002',
      'serviceId', '32000000-0000-4000-8000-000000000001',
      'startTime', '2030-01-07T12:00:00Z'
    )
  );
  v_first_id := (v_first -> 'appointment' ->> 'id')::uuid;

  IF (v_first -> 'appointment' ->> 'end_time')::timestamptz <> '2030-01-07T12:30:00Z'::timestamptz THEN
    RAISE EXCEPTION 'Duração não foi derivada do serviço.';
  END IF;

  PERFORM public.manage_appointment_command(
    '31000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'action', 'reschedule',
      'appointmentId', v_first_id,
      'employeeId', '31000000-0000-4000-8000-000000000002',
      'serviceId', '32000000-0000-4000-8000-000000000001',
      'startTime', '2030-01-07T14:00:00Z'
    )
  );

  BEGIN
    PERFORM public.manage_appointment_command(
      '31000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'action', 'update-status',
        'appointmentId', v_first_id,
        'status', 'completed'
      )
    );
    RAISE EXCEPTION 'Transição inválida foi aceita.';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN NULL;
  END;

  BEGIN
    PERFORM public.manage_appointment_command(
      '31000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'action', 'create',
        'customerName', 'Fora do expediente',
        'employeeId', '31000000-0000-4000-8000-000000000002',
        'serviceId', '32000000-0000-4000-8000-000000000001',
        'startTime', '2030-01-07T21:00:00Z'
      )
    );
    RAISE EXCEPTION 'Horário fora do expediente foi aceito.';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN NULL;
  END;

  PERFORM public.manage_appointment_command(
    '31000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'action', 'create-block',
      'employeeId', '31000000-0000-4000-8000-000000000002',
      'startTime', '2030-01-07T15:00:00Z',
      'endTime', '2030-01-07T16:00:00Z',
      'reason', 'Pausa'
    )
  );

  BEGIN
    PERFORM public.manage_appointment_command(
      '31000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'action', 'create',
        'customerName', 'Conflito com bloqueio',
        'employeeId', '31000000-0000-4000-8000-000000000002',
        'serviceId', '32000000-0000-4000-8000-000000000001',
        'startTime', '2030-01-07T15:00:00Z'
      )
    );
    RAISE EXCEPTION 'Bloqueio não impediu agendamento.';
  EXCEPTION
    WHEN SQLSTATE '23P01' THEN NULL;
  END;

  v_second := public.manage_appointment_command(
    '31000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'action', 'create',
      'customerName', 'Primeira reserva concorrente',
      'employeeId', '31000000-0000-4000-8000-000000000002',
      'serviceId', '32000000-0000-4000-8000-000000000001',
      'startTime', '2030-01-07T16:00:00Z'
    )
  );

  BEGIN
    PERFORM public.manage_appointment_command(
      '31000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'action', 'create',
        'customerName', 'Segunda reserva concorrente',
        'employeeId', '31000000-0000-4000-8000-000000000002',
        'serviceId', '32000000-0000-4000-8000-000000000001',
        'startTime', '2030-01-07T16:00:00Z'
      )
    );
    RAISE EXCEPTION 'Sobreposição não foi bloqueada.';
  EXCEPTION
    WHEN SQLSTATE '23P01' THEN NULL;
  END;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
  BEGIN
    INSERT INTO public.appointments (
      organization_id, customer_name, start_time, end_time
    )
    VALUES (
      '30000000-0000-4000-8000-000000000001',
      'Escrita direta proibida',
      '2030-01-07T17:00:00Z',
      '2030-01-07T17:30:00Z'
    );
  EXCEPTION
    WHEN insufficient_privilege THEN v_direct_write_blocked := true;
  END;
  RESET ROLE;

  IF NOT v_direct_write_blocked THEN
    RAISE EXCEPTION 'Browser autenticado ainda pode gravar appointments diretamente.';
  END IF;
END;
$$;

ROLLBACK;
