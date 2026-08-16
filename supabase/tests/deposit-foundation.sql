-- Teste transacional da fundação de sinal da SPEC-008.
-- Execute somente no Supabase de teste com role administrativa.
-- @author André Narcizo

BEGIN;

INSERT INTO public.organizations (id, name, slug)
VALUES
  ('80000000-0000-4000-8000-000000000001', 'Sinal organização A', 'sinal-org-a'),
  ('80000000-0000-4000-8000-000000000002', 'Sinal organização B', 'sinal-org-b');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'owner-a@sinal.test', 'not-used-in-test', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner A"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'owner-b@sinal.test', 'not-used-in-test', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner B"}'::jsonb, now(), now()
  );

UPDATE public.profiles
SET organization_id = '80000000-0000-4000-8000-000000000001',
    role = 'owner'
WHERE id = '81000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET organization_id = '80000000-0000-4000-8000-000000000002',
    role = 'owner'
WHERE id = '81000000-0000-4000-8000-000000000002';

INSERT INTO public.services (id, duration_minutes, name, organization_id, price)
VALUES
  ('82000000-0000-4000-8000-000000000001', 30, 'Serviço A', '80000000-0000-4000-8000-000000000001', 80),
  ('82000000-0000-4000-8000-000000000002', 30, 'Serviço B', '80000000-0000-4000-8000-000000000002', 100);

INSERT INTO public.appointments (id, end_time, organization_id, service_id, start_time, status)
VALUES
  (
    '83000000-0000-4000-8000-000000000001', now() + interval '2 days 30 minutes',
    '80000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001',
    now() + interval '2 days', 'pending'
  ),
  (
    '83000000-0000-4000-8000-000000000002', now() + interval '3 days 30 minutes',
    '80000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002',
    now() + interval '3 days', 'pending'
  );

INSERT INTO public.deposit_policies (
  deposit_type, deposit_value, organization_id, payment_window_minutes, service_id
)
VALUES
  ('fixed', 10, '80000000-0000-4000-8000-000000000001', 30, NULL),
  ('percentage', 25, '80000000-0000-4000-8000-000000000001', 30, '82000000-0000-4000-8000-000000000001'),
  ('fixed', 15, '80000000-0000-4000-8000-000000000002', 30, '82000000-0000-4000-8000-000000000002');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_first_deposit public.appointment_deposits%ROWTYPE;
  v_second_deposit public.appointment_deposits%ROWTYPE;
BEGIN
  v_first_deposit := public.create_pending_appointment_deposit(
    '83000000-0000-4000-8000-000000000001'
  );
  v_second_deposit := public.create_pending_appointment_deposit(
    '83000000-0000-4000-8000-000000000001'
  );

  IF v_first_deposit.amount <> 20 OR v_first_deposit.id <> v_second_deposit.id THEN
    RAISE EXCEPTION 'Sinal não foi calculado no servidor ou não foi idempotente.';
  END IF;

  IF (SELECT count(*) FROM public.appointment_deposits) <> 1 THEN
    RAISE EXCEPTION 'RLS expôs sinais de outra organização.';
  END IF;

  IF (SELECT count(*) FROM public.deposit_policies) <> 2 THEN
    RAISE EXCEPTION 'RLS expôs políticas de outra organização.';
  END IF;

  BEGIN
    INSERT INTO public.appointment_deposits (
      amount, appointment_id, expires_at, organization_id
    )
    VALUES (
      1, '83000000-0000-4000-8000-000000000001', now() + interval '1 hour',
      '80000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'Cliente autenticado inseriu sinal diretamente.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.create_pending_appointment_deposit('83000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'RPC permitiu criar sinal de outra organização.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;

UPDATE public.appointment_deposits
SET expires_at = now() - interval '1 minute'
WHERE appointment_id = '83000000-0000-4000-8000-000000000001';

DO $$
BEGIN
  IF public.expire_pending_appointment_deposits() <> 1 THEN
    RAISE EXCEPTION 'Expiração não encontrou o sinal pendente vencido.';
  END IF;

  IF (SELECT status FROM public.appointment_deposits WHERE appointment_id = '83000000-0000-4000-8000-000000000001') <> 'expired' THEN
    RAISE EXCEPTION 'Sinal vencido não foi marcado como expirado.';
  END IF;

  IF (SELECT status FROM public.appointments WHERE id = '83000000-0000-4000-8000-000000000001') <> 'cancelled' THEN
    RAISE EXCEPTION 'Agendamento pendente não foi liberado após expiração do sinal.';
  END IF;

  IF has_table_privilege('authenticated', 'public.appointment_deposits', 'INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'authenticated ainda pode alterar sinais diretamente.';
  END IF;

  IF has_function_privilege('authenticated', 'public.expire_pending_appointment_deposits()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated ainda pode expirar sinais diretamente.';
  END IF;
END;
$$;

ROLLBACK;
