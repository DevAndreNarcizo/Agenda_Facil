-- Teste transacional da migration 20261004_000001 (permissões do painel e analytics).
-- Execute somente em ambiente de teste/staging com uma role administrativa.
-- Todas as fixtures são descartadas ao final com ROLLBACK.
--
-- @author André Narcizo - andre.narcizo@sysout.com.br

BEGIN;

INSERT INTO public.organizations (id, name, slug, plan_name, subscription_status)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Org A - painel', 'org-a-painel-test', 'starter', 'trialing'),
  ('b0000000-0000-4000-8000-000000000002', 'Org B - painel', 'org-b-painel-test', 'starter', 'trialing');

-- Somente colunas comuns ao stub local e ao GoTrue (as demais são opcionais).
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT id, 'authenticated', 'authenticated', email, 'not-used-in-test', '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', email), now(), now()
FROM (VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'owner-a@painel.test'),
  ('a2000000-0000-4000-8000-000000000002'::uuid, 'admin-a@painel.test'),
  ('a3000000-0000-4000-8000-000000000003'::uuid, 'employee-a@painel.test'),
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'owner-b@painel.test')
) AS users(id, email);

-- ON CONFLICT cobre ambientes em que o gatilho de cadastro já criou o perfil.
INSERT INTO public.profiles (id, organization_id, role, full_name)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner', 'Owner A'),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Admin A'),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'employee', 'Employee A'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'owner', 'Owner B')
ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, role = EXCLUDED.role, full_name = EXCLUDED.full_name;

INSERT INTO public.services (id, organization_id, name, duration_minutes, price)
VALUES
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Serviço A', 60, 100),
  ('b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Serviço B', 60, 999);

INSERT INTO public.customers (id, organization_id, name, phone)
VALUES ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Cliente A', '5511999990001');

INSERT INTO public.appointments (organization_id, service_id, employee_id, customer_name, start_time, end_time, status, amount_paid, payment_status)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'Cliente A', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'completed', 0, 'paid'),
  ('a0000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'Cliente A', now() + interval '1 day', now() + interval '1 day 1 hour', 'pending', 0, 'pending'),
  ('b0000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Cliente B', now() - interval '1 day', now() - interval '1 day' + interval '1 hour', 'completed', 999, 'paid');

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  affected integer;
  stats record;
BEGIN
  -- Owner edita a identidade da própria organização.
  PERFORM set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
  UPDATE public.organizations SET name = 'Org A renomeada' WHERE id = 'a0000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner não conseguiu editar a organização'; END IF;

  -- Plano/assinatura não são graváveis pelo cliente (privilégio de coluna).
  BEGIN
    UPDATE public.organizations SET plan_name = 'clinic' WHERE id = 'a0000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Cliente alterou plan_name';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Nenhuma escrita em outra organização.
  UPDATE public.organizations SET name = 'invadida' WHERE id = 'b0000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Owner editou organização de outro tenant'; END IF;

  -- Owner gerencia a equipe, mas não promove ninguém a owner.
  UPDATE public.profiles SET full_name = 'Employee A2' WHERE id = 'a3000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner não conseguiu editar profissional'; END IF;
  BEGIN
    UPDATE public.profiles SET role = 'owner' WHERE id = 'a2000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Promoção a owner foi aceita';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Analytics escopado: só enxerga a própria organização (B tem 999 de receita).
  SELECT * INTO stats FROM public.get_dashboard_stats();
  IF stats.total_appointments <> 1 OR stats.total_revenue <> 100 THEN
    RAISE EXCEPTION 'Analytics vazou ou errou: % atendimentos, receita %', stats.total_appointments, stats.total_revenue;
  END IF;
  SELECT * INTO stats FROM public.get_period_summary(now() - interval '7 days', now() + interval '7 days');
  IF stats.total <> 2 OR stats.pending <> 1 OR stats.paid_revenue <> 100 THEN
    RAISE EXCEPTION 'Resumo do período incorreto: total %, pendentes %, receita %', stats.total, stats.pending, stats.paid_revenue;
  END IF;

  -- Admin não edita o owner nem o próprio papel.
  PERFORM set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
  UPDATE public.profiles SET full_name = 'x' WHERE id = 'a1000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Admin editou o owner'; END IF;
  BEGIN
    UPDATE public.profiles SET role = 'employee' WHERE id = 'a2000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Admin alterou o próprio papel';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Profissional comum: lê catálogo, mas não altera preço, horário nem organização.
  PERFORM set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000003', true);
  IF (SELECT count(*) FROM public.services) <> 1 THEN RAISE EXCEPTION 'Profissional não leu o catálogo'; END IF;
  UPDATE public.services SET price = 1 WHERE id = 'a5000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Profissional alterou preço'; END IF;
  UPDATE public.organizations SET name = 'x' WHERE id = 'a0000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Profissional editou a organização'; END IF;
  BEGIN
    INSERT INTO public.organization_business_hours (organization_id, day_of_week, is_active, start_time, end_time)
    VALUES ('a0000000-0000-4000-8000-000000000001', 1, true, '08:00', '18:00');
    RAISE EXCEPTION 'Profissional alterou horário de funcionamento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM public.customers WHERE id = 'a6000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Profissional excluiu cliente'; END IF;
  -- Mas segue cadastrando e editando clientes.
  UPDATE public.customers SET name = 'Cliente A editado' WHERE id = 'a6000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Profissional não conseguiu editar cliente'; END IF;
END;
$$;

ROLLBACK;
