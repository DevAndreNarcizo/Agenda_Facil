-- Teste transacional da migration 20261005000001 (cadastro e onboarding endurecidos).
-- Execute somente em ambiente de teste/staging com uma role administrativa.
-- Todas as fixtures são descartadas ao final com ROLLBACK.
--
-- @author André Narcizo - andre.narcizo@sysout.com.br

BEGIN;

INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES ('c0000000-0000-4000-8000-000000000001', 'Org vítima', 'org-vitima-signup-test', NULL);

-- 1. Metadados forjados no signUp (organization_id + role) são ignorados.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'atacante@signup.test', 'x',
  '{"provider":"email"}',
  '{"full_name":"Atacante","organization_id":"c0000000-0000-4000-8000-000000000001","role":"admin"}',
  now(), now()
);

DO $$
DECLARE v_org uuid; v_role text;
BEGIN
  SELECT organization_id, role INTO v_org, v_role FROM public.profiles WHERE id = 'c1000000-0000-4000-8000-000000000001';
  ASSERT v_org IS NULL, 'metadado organization_id não pode vincular o usuário a uma empresa';
  ASSERT v_role = 'owner', 'papel do autocadastro deve ser owner, ignorando o metadado role';
END $$;

-- 2. Autocadastro completo: cria empresa, segmento e telefone normalizado.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'c2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dona@signup.test', 'x',
  '{"provider":"email"}',
  '{"full_name":"Dona","org_name":"Pet da Ana","org_slug":"pet-da-ana-signup-test","segment":"pet","phone":"(11) 91234-5678"}',
  now(), now()
);

DO $$
DECLARE v_org uuid; v_owner uuid; v_segment text; v_phone text;
BEGIN
  SELECT p.organization_id, p.phone, o.owner_id INTO v_org, v_phone, v_owner
  FROM public.profiles p JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = 'c2000000-0000-4000-8000-000000000002';
  SELECT segment INTO v_segment FROM public.organization_settings WHERE organization_id = v_org;
  ASSERT v_owner = 'c2000000-0000-4000-8000-000000000002', 'empresa do autocadastro pertence ao novo usuário';
  ASSERT v_segment = 'pet', 'segmento válido é gravado';
  ASSERT v_phone = '11912345678', 'telefone é gravado só com dígitos';
END $$;

-- 3. Slug inválido não cria empresa; segmento e telefone inválidos são descartados.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'c3000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'invalido@signup.test', 'x',
  '{"provider":"email"}',
  '{"org_name":"X","org_slug":"Slug Inválido!","segment":"hacker","phone":"123"}',
  now(), now()
);

DO $$
DECLARE v_org uuid; v_phone text; v_name text;
BEGIN
  SELECT organization_id, phone, full_name INTO v_org, v_phone, v_name FROM public.profiles WHERE id = 'c3000000-0000-4000-8000-000000000003';
  ASSERT v_org IS NULL, 'slug inválido não cria empresa';
  ASSERT v_phone IS NULL, 'telefone com menos de 10 dígitos é descartado';
  ASSERT v_name = 'invalido', 'sem nome, usa a parte local do e-mail';
END $$;

-- 4. Funcionário não consegue assumir a empresa pelo onboarding.
UPDATE public.profiles SET organization_id = 'c0000000-0000-4000-8000-000000000001', role = 'employee'
WHERE id = 'c3000000-0000-4000-8000-000000000003';
UPDATE public.organizations SET owner_id = 'c2000000-0000-4000-8000-000000000002'
WHERE id = 'c0000000-0000-4000-8000-000000000001';

DO $$
DECLARE v_failed boolean := false; v_owner uuid;
BEGIN
  BEGIN
    PERFORM public.complete_onboarding(
      'c3000000-0000-4000-8000-000000000003',
      jsonb_build_object('slug', 'tomada', 'businessName', 'Tomada', 'serviceName', 'Corte', 'serviceDuration', 30, 'servicePrice', 10,
        'schedule', (SELECT jsonb_agg(jsonb_build_object('dayOfWeek', d, 'active', true, 'start', '08:00', 'end', '18:00')) FROM generate_series(0, 6) d))
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  SELECT owner_id INTO v_owner FROM public.organizations WHERE id = 'c0000000-0000-4000-8000-000000000001';
  ASSERT v_failed, 'onboarding por funcionário deve falhar com insufficient_privilege';
  ASSERT v_owner = 'c2000000-0000-4000-8000-000000000002', 'owner_id não pode mudar';
END $$;

-- 5. Owner continua podendo concluir o onboarding da própria empresa (preserva o segmento).
DO $$
DECLARE v_org uuid; v_done timestamptz; v_segment text;
BEGIN
  v_org := public.complete_onboarding(
    'c2000000-0000-4000-8000-000000000002',
    jsonb_build_object('slug', 'pet-da-ana-signup-test', 'businessName', 'Pet da Ana', 'serviceName', 'Banho', 'serviceDuration', 60, 'servicePrice', 80,
      'schedule', (SELECT jsonb_agg(jsonb_build_object('dayOfWeek', d, 'active', d BETWEEN 1 AND 5, 'start', '08:00', 'end', '18:00')) FROM generate_series(0, 6) d))
  );
  SELECT onboarding_completed_at INTO v_done FROM public.organizations WHERE id = v_org;
  SELECT segment INTO v_segment FROM public.organization_settings WHERE organization_id = v_org;
  ASSERT v_done IS NOT NULL, 'onboarding do owner conclui';
  ASSERT v_segment = 'pet', 'onboarding não apaga o segmento do cadastro';
END $$;

-- 6. Nenhuma role de cliente executa as funções DEFINER diretamente.
DO $$
BEGIN
  ASSERT NOT has_function_privilege('authenticated', 'public.complete_onboarding(uuid, jsonb)', 'execute'), 'authenticated não executa complete_onboarding';
  ASSERT NOT has_function_privilege('anon', 'public.complete_onboarding(uuid, jsonb)', 'execute'), 'anon não executa complete_onboarding';
  ASSERT NOT has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon não executa handle_new_user';
END $$;

ROLLBACK;
