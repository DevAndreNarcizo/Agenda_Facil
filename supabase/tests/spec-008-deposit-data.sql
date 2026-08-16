-- Teste transacional da camada de dados de sinal da SPEC-008.
-- Execute somente no Supabase de teste com uma role administrativa.
-- @author André Narcizo

BEGIN;

INSERT INTO public.organizations (id, name, slug)
VALUES
  ('80000000-0000-4000-8000-000000000001', 'Sinais A teste', 'sinais-a-teste'),
  ('80000000-0000-4000-8000-000000000002', 'Sinais B teste', 'sinais-b-teste');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'owner-a@sinais.test', 'not-used-in-test', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner sinais A"}'::jsonb, now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'owner-b@sinais.test', 'not-used-in-test', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner sinais B"}'::jsonb, now(), now()
  );

UPDATE public.profiles
SET organization_id = '80000000-0000-4000-8000-000000000001', role = 'owner'
WHERE id = '81000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET organization_id = '80000000-0000-4000-8000-000000000002', role = 'owner'
WHERE id = '81000000-0000-4000-8000-000000000002';

INSERT INTO public.services (id, duration_minutes, is_active, name, organization_id, price)
VALUES
  ('82000000-0000-4000-8000-000000000001', 30, true, 'Serviço percentual', '80000000-0000-4000-8000-000000000001', 200),
  ('82000000-0000-4000-8000-000000000002', 30, true, 'Serviço fixo', '80000000-0000-4000-8000-000000000001', 160),
  ('82000000-0000-4000-8000-000000000003', 30, true, 'Serviço outro tenant', '80000000-0000-4000-8000-000000000002', 100);

INSERT INTO public.appointments (id, end_time, organization_id, service_id, start_time, status)
VALUES
  (
    '83000000-0000-4000-8000-000000000001', now() + interval '2 days 30 minutes',
    '80000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001',
    now() + interval '2 days', 'pending'
  ),
  (
    '83000000-0000-4000-8000-000000000002', now() + interval '3 days 30 minutes',
    '80000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
    now() + interval '3 days', 'pending'
  ),
  (
    '83000000-0000-4000-8000-000000000003', now() + interval '2 days 30 minutes',
    '80000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000003',
    now() + interval '2 days', 'pending'
  );

INSERT INTO public.deposit_policies (
  deposit_mode, deposit_value, expiration_minutes, is_enabled, organization_id, service_id
)
VALUES
  ('percentage', 25, 15, true, '80000000-0000-4000-8000-000000000001', NULL),
  ('fixed', 45, 15, true, '80000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002'),
  ('fixed', 20, 15, true, '80000000-0000-4000-8000-000000000002', NULL);

DO $$
DECLARE
  v_default_deposit public.appointment_deposits%ROWTYPE;
  v_idempotent_deposit public.appointment_deposits%ROWTYPE;
  v_service_deposit public.appointment_deposits%ROWTYPE;
  v_other_tenant_deposit public.appointment_deposits%ROWTYPE;
  v_expired_count integer;
BEGIN
  v_default_deposit := public.create_pending_appointment_deposit('83000000-0000-4000-8000-000000000001');
  v_idempotent_deposit := public.create_pending_appointment_deposit('83000000-0000-4000-8000-000000000001');
  v_service_deposit := public.create_pending_appointment_deposit('83000000-0000-4000-8000-000000000002');
  v_other_tenant_deposit := public.create_pending_appointment_deposit('83000000-0000-4000-8000-000000000003');

  IF v_default_deposit.amount <> 50 THEN
    RAISE EXCEPTION 'O valor percentual não foi calculado pelo servidor.';
  END IF;

  IF v_service_deposit.amount <> 45 THEN
    RAISE EXCEPTION 'A política específica do serviço não sobrepôs a política padrão.';
  END IF;

  IF v_default_deposit.id <> v_idempotent_deposit.id
    OR (SELECT count(*) FROM public.appointment_deposits WHERE appointment_id = '83000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'A criação de sinal não foi idempotente por agendamento.';
  END IF;

  UPDATE public.appointment_deposits
  SET
    created_at = now() - interval '2 seconds',
    expires_at = now() - interval '1 second'
  WHERE id = v_default_deposit.id;

  v_expired_count := public.expire_pending_appointment_deposits(10);
  IF v_expired_count <> 1
    OR (SELECT status FROM public.appointment_deposits WHERE id = v_default_deposit.id) <> 'expired'
    OR (SELECT status FROM public.appointments WHERE id = v_default_deposit.appointment_id) <> 'cancelled' THEN
    RAISE EXCEPTION 'A expiração não liberou o horário pendente.';
  END IF;

  IF v_other_tenant_deposit.amount <> 20 THEN
    RAISE EXCEPTION 'Fixture de outro tenant não foi criada corretamente.';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.deposit_policies) <> 2 THEN
    RAISE EXCEPTION 'RLS falhou: políticas de outro tenant ficaram visíveis.';
  END IF;

  IF (SELECT count(*) FROM public.appointment_deposits) <> 2 THEN
    RAISE EXCEPTION 'RLS falhou: sinais de outro tenant ficaram visíveis.';
  END IF;

  BEGIN
    UPDATE public.appointment_deposits
    SET status = 'paid', paid_at = now()
    WHERE appointment_id = '83000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'RLS falhou: cliente alterou sinal diretamente.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.create_pending_appointment_deposit('83000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'RLS falhou: cliente autenticado chamou RPC administrativa.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

ROLLBACK;
