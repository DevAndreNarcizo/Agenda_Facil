-- Endurece o cadastro e o onboarding contra escalada de privilégio e passa a guardar
-- WhatsApp e segmento informados na criação da conta.
--
-- Falhas corrigidas:
-- 1. handle_new_user confiava em raw_user_meta_data->>'organization_id' e ->>'role'. Esses
--    metadados são definidos pelo próprio cliente no signUp, então qualquer pessoa que soubesse
--    o UUID de uma empresa entrava nela com o papel que quisesse (inclusive owner).
--    Agora o vínculo com empresa existente só acontece por caminho de servidor
--    (Edge Function create-employee, com service role) e o papel de autocadastro é sempre owner.
-- 2. complete_onboarding, quando o perfil já tinha empresa, sobrescrevia owner_id com o
--    chamador. Um funcionário que chamasse a Edge Function complete-onboarding virava dono
--    da empresa. Agora só o owner pode reexecutar o onboarding de uma empresa existente.
--
-- Migration aditiva: apenas CREATE OR REPLACE e ADD COLUMN; grants e owners são preservados.
--
-- @author André Narcizo - andre.narcizo@sysout.com.br

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS segment text
  CHECK (segment IS NULL OR segment IN ('estetica', 'beleza', 'cabelo', 'pet'));

COMMENT ON COLUMN public.organization_settings.segment IS
  'Segmento escolhido no cadastro (estetica, beleza, cabelo, pet); orienta sugestões de serviços.';

/**
 * Cria o perfil (e, no autocadastro com slug válido, a empresa) de cada novo usuário do Auth.
 * Nunca lê organization_id/role de raw_user_meta_data: esses dados vêm do cliente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_org_id uuid;
  v_full_name text := left(nullif(trim(v_meta ->> 'full_name'), ''), 120);
  v_org_name text := left(nullif(trim(v_meta ->> 'org_name'), ''), 120);
  v_org_slug text := lower(nullif(trim(v_meta ->> 'org_slug'), ''));
  v_segment text := nullif(v_meta ->> 'segment', '');
  -- Telefone: dígitos do formulário (DDD + número) ou o telefone do login por WhatsApp/SMS.
  v_phone text := nullif(regexp_replace(coalesce(v_meta ->> 'phone', to_jsonb(new) ->> 'phone', ''), '\D', '', 'g'), '');
BEGIN
  IF v_full_name IS NULL THEN
    v_full_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuário');
  END IF;

  IF v_phone IS NOT NULL AND length(v_phone) NOT BETWEEN 10 AND 13 THEN
    v_phone := NULL;
  END IF;

  IF v_segment IS NOT NULL AND v_segment NOT IN ('estetica', 'beleza', 'cabelo', 'pet') THEN
    v_segment := NULL;
  END IF;

  -- Empresa só é criada no autocadastro com slug válido; sem ele o usuário segue para o onboarding.
  IF v_org_slug IS NOT NULL AND length(v_org_slug) BETWEEN 3 AND 80 AND v_org_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    INSERT INTO public.organizations (name, slug, owner_id)
    VALUES (coalesce(v_org_name, 'Minha Empresa'), v_org_slug, new.id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_settings (organization_id, segment)
    VALUES (v_org_id, v_segment)
    ON CONFLICT (organization_id) DO UPDATE SET segment = EXCLUDED.segment, updated_at = now();
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, email, phone, role)
  VALUES (new.id, v_org_id, v_full_name, new.email, v_phone, 'owner')
  -- Em conflito só atualiza dados de contato: vínculo e papel nunca mudam por aqui.
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = coalesce(EXCLUDED.phone, public.profiles.phone),
        updated_at = now();

  RETURN new;
END;
$$;

/**
 * Onboarding transacional. Mesmo comportamento anterior, com a verificação de que, se o
 * perfil já pertence a uma empresa, o chamador é o owner dela.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_role text;
  v_slug text := lower(trim(p_payload ->> 'slug'));
  v_business_name text := trim(p_payload ->> 'businessName');
  v_service_name text := trim(p_payload ->> 'serviceName');
BEGIN
  IF v_business_name = '' OR v_service_name = '' OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Dados de onboarding inválidos' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'schedule') <> 'array' OR jsonb_array_length(p_payload -> 'schedule') <> 7 THEN
    RAISE EXCEPTION 'Horários inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id, role INTO v_organization_id, v_role
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_organization_id IS NULL THEN
    INSERT INTO public.organizations (name, owner_id, slug)
    VALUES (v_business_name, p_user_id, v_slug)
    RETURNING id INTO v_organization_id;

    UPDATE public.profiles
    SET organization_id = v_organization_id, role = 'owner', updated_at = now()
    WHERE id = p_user_id;
  ELSE
    -- Funcionário/admin não pode reconfigurar nem assumir a empresa pelo onboarding.
    IF v_role IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Somente o proprietário pode concluir o onboarding da empresa' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug AND id <> v_organization_id) THEN
      RAISE EXCEPTION 'Slug indisponível' USING ERRCODE = '23505';
    END IF;

    UPDATE public.organizations
    SET name = v_business_name, slug = v_slug, updated_at = now()
    WHERE id = v_organization_id;
  END IF;

  INSERT INTO public.organization_settings (address, bio, instagram, organization_id, specialty, timezone, updated_at)
  VALUES (
    jsonb_build_object('address', p_payload ->> 'address', 'cep', p_payload ->> 'cep', 'city', p_payload ->> 'city', 'number', p_payload ->> 'number', 'state', p_payload ->> 'state'),
    coalesce(p_payload ->> 'bio', ''), coalesce(p_payload ->> 'instagram', ''), v_organization_id,
    coalesce(p_payload ->> 'specialty', ''), 'America/Sao_Paulo', now()
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET address = EXCLUDED.address, bio = EXCLUDED.bio, instagram = EXCLUDED.instagram,
      specialty = EXCLUDED.specialty, timezone = EXCLUDED.timezone, updated_at = now();

  DELETE FROM public.organization_business_hours WHERE organization_id = v_organization_id;
  INSERT INTO public.organization_business_hours (day_of_week, end_time, is_active, organization_id, start_time)
  SELECT (entry ->> 'dayOfWeek')::smallint, (entry ->> 'end')::time, coalesce((entry ->> 'active')::boolean, false), v_organization_id, (entry ->> 'start')::time
  FROM jsonb_array_elements(p_payload -> 'schedule') AS entry;

  INSERT INTO public.services (category, duration_minutes, name, organization_id, price)
  VALUES (coalesce(nullif(p_payload ->> 'serviceCategory', ''), 'Geral'), (p_payload ->> 'serviceDuration')::integer, v_service_name, v_organization_id, (p_payload ->> 'servicePrice')::numeric)
  ON CONFLICT (organization_id, name) DO UPDATE
  SET category = EXCLUDED.category, duration_minutes = EXCLUDED.duration_minutes, price = EXCLUDED.price;

  UPDATE public.organizations SET onboarding_completed_at = now() WHERE id = v_organization_id;
  RETURN v_organization_id;
END;
$$;

-- Garante que o gatilho de cadastro exista (em produção já existe com este nome).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- Funções DEFINER chamadas apenas por gatilho ou Edge Function com service role:
-- nenhuma role de cliente executa (CREATE OR REPLACE preserva os grants já restritos em produção).
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.complete_onboarding(uuid, jsonb)', 'execute')
     OR has_function_privilege('anon', 'public.complete_onboarding(uuid, jsonb)', 'execute') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.complete_onboarding(uuid, jsonb) FROM PUBLIC, anon, authenticated';
  END IF;
  IF has_function_privilege('authenticated', 'public.handle_new_user()', 'execute')
     OR has_function_privilege('anon', 'public.handle_new_user()', 'execute') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
