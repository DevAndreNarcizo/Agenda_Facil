-- Teste transacional da matriz RLS do SPEC-001.
-- Execute somente em ambiente de teste/staging com uma role administrativa.
-- Todos os dados de fixture sao descartados ao final com ROLLBACK.

BEGIN;

INSERT INTO public.organizations (id, name, slug)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Organizacao A - teste RLS', 'org-a-rls-test'),
  ('20000000-0000-4000-8000-000000000002', 'Organizacao B - teste RLS', 'org-b-rls-test');

-- O gatilho de cadastro cria os perfis a partir dos metadados do usuário.
INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '11000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner-a@rls.test',
    'not-used-in-test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner A","organization_id":"10000000-0000-4000-8000-000000000001","role":"owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'admin-a@rls.test',
    'not-used-in-test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin A","organization_id":"10000000-0000-4000-8000-000000000001","role":"admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'employee-a@rls.test',
    'not-used-in-test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Employee A","organization_id":"10000000-0000-4000-8000-000000000001","role":"employee"}'::jsonb,
    now(),
    now()
  ),
  (
    '22000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner-b@rls.test',
    'not-used-in-test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner B","organization_id":"20000000-0000-4000-8000-000000000002","role":"owner"}'::jsonb,
    now(),
    now()
  );

INSERT INTO public.customers (id, name, organization_id, phone)
VALUES
  ('12000000-0000-4000-8000-000000000001', 'Cliente A', '10000000-0000-4000-8000-000000000001', '5511999990001'),
  ('22000000-0000-4000-8000-000000000002', 'Cliente B', '20000000-0000-4000-8000-000000000002', '5511999990002');

INSERT INTO public.services (id, duration_minutes, name, organization_id, price)
VALUES
  ('13000000-0000-4000-8000-000000000001', 30, 'Servico A', '10000000-0000-4000-8000-000000000001', 50),
  ('23000000-0000-4000-8000-000000000002', 30, 'Servico B', '20000000-0000-4000-8000-000000000002', 50);

INSERT INTO public.appointments (
  id,
  customer_id,
  employee_id,
  end_time,
  organization_id,
  service_id,
  start_time
)
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000003',
    '2030-01-01 10:00:00+00',
    '10000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '2030-01-01 09:30:00+00'
  ),
  (
    '24000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000001',
    '2030-01-01 10:00:00+00',
    '20000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000002',
    '2030-01-01 09:30:00+00'
  );

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  affected_rows integer;
  test_user_id uuid;
BEGIN
  FOREACH test_user_id IN ARRAY ARRAY[
    '11000000-0000-4000-8000-000000000001'::uuid,
    '11000000-0000-4000-8000-000000000002'::uuid,
    '11000000-0000-4000-8000-000000000003'::uuid
  ]
  LOOP
    PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);

    IF (SELECT count(*) FROM public.organizations) <> 1 THEN
      RAISE EXCEPTION 'RLS falhou: usuário % visualizou organizações de outro tenant', test_user_id;
    END IF;

    IF (SELECT count(*) FROM public.profiles) <> 3 THEN
      RAISE EXCEPTION 'RLS falhou: usuário % visualizou perfis de outro tenant', test_user_id;
    END IF;

    IF (SELECT count(*) FROM public.customers) <> 1 THEN
      RAISE EXCEPTION 'RLS falhou: usuário % visualizou clientes de outro tenant', test_user_id;
    END IF;

    IF (SELECT count(*) FROM public.services) <> 1 THEN
      RAISE EXCEPTION 'RLS falhou: usuário % visualizou serviços de outro tenant', test_user_id;
    END IF;

    IF (SELECT count(*) FROM public.appointments) <> 1 THEN
      RAISE EXCEPTION 'RLS falhou: usuário % visualizou agendamentos de outro tenant', test_user_id;
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

  BEGIN
    INSERT INTO public.customers (name, organization_id, phone)
    VALUES ('Cliente indevido', '20000000-0000-4000-8000-000000000002', '5511999990003');

    RAISE EXCEPTION 'RLS falhou: inserção entre tenants foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- Desde a migration 20261004_000001 o owner gerencia a equipe, mas a promoção a owner
  -- é recusada explicitamente pelo WITH CHECK (antes resultava em 0 linhas).
  BEGIN
    UPDATE public.profiles
    SET role = 'owner'
    WHERE id = '11000000-0000-4000-8000-000000000002';

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 0 THEN
      RAISE EXCEPTION 'RLS falhou: escalação de privilégio foi aceita';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
