-- ====== SCRIPT DEFINITIVO PARA CORREÇÃO DE RLS ======
-- Execute este script INTEIRO no SQL Editor do Supabase.
-- Ele limpa TODAS as políticas antigas e recria de forma segura.

-- =====================================================
-- PASSO 1: Função segura para buscar organization_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- =====================================================
-- PASSO 2: Limpar TODAS as políticas existentes
-- =====================================================

-- Limpa policies de profiles
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Limpa policies de organizations
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'organizations' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policyname);
  END LOOP;
END $$;

-- Limpa policies de services
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'services' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', pol.policyname);
  END LOOP;
END $$;

-- Limpa policies de customers
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'customers' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', pol.policyname);
  END LOOP;
END $$;

-- Limpa policies de appointments
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointments', pol.policyname);
  END LOOP;
END $$;

-- =====================================================
-- PASSO 3: Ativar RLS em todas as tabelas
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Ativar RLS apenas se a tabela existir
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
    ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASSO 4: Políticas para PROFILES
-- =====================================================

-- SELECT: ver próprio perfil OU perfis da mesma organização
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
USING ( id = auth.uid() OR organization_id = public.get_user_organization_id() );

-- INSERT: criar próprio perfil (registro) OU admin criando employee na org
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
WITH CHECK ( id = auth.uid() OR organization_id = public.get_user_organization_id() );

-- UPDATE: atualizar próprio perfil OU perfis da mesma org OU perfis sem org (onboarding de employees)
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
USING (
  id = auth.uid()
  OR organization_id = public.get_user_organization_id()
  OR (organization_id IS NULL AND public.get_user_organization_id() IS NOT NULL)
)
WITH CHECK (
  id = auth.uid()
  OR organization_id = public.get_user_organization_id()
  OR organization_id IS NULL
);

-- DELETE: apenas admin da org
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
USING ( organization_id = public.get_user_organization_id() );

-- =====================================================
-- PASSO 5: Políticas para ORGANIZATIONS
-- =====================================================

-- SELECT: ver a própria organização OU qualquer org se ainda não tem org (onboarding)
CREATE POLICY "organizations_select" ON public.organizations FOR SELECT
USING (
  id = public.get_user_organization_id()
  OR public.get_user_organization_id() IS NULL
);

-- INSERT: qualquer usuário autenticado pode criar (onboarding)
-- RETURNING: usar auth.uid() IS NOT NULL para permitir retorno do id após insert
CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT
WITH CHECK ( auth.uid() IS NOT NULL );

-- UPDATE: apenas membros da organização
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE
USING ( id = public.get_user_organization_id() );

-- =====================================================
-- PASSO 6: Políticas para SERVICES (se existir)
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
    -- SELECT: membros da org OU acesso público ao portal (anon pode ver serviços)
    EXECUTE 'CREATE POLICY "services_select" ON public.services FOR SELECT USING ( organization_id = public.get_user_organization_id() OR public.get_user_organization_id() IS NULL )';
    EXECUTE 'CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "services_update" ON public.services FOR UPDATE USING ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "services_delete" ON public.services FOR DELETE USING ( organization_id = public.get_user_organization_id() )';
  END IF;
END $$;

-- =====================================================
-- PASSO 7: Políticas para CUSTOMERS (se existir)
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    EXECUTE 'CREATE POLICY "customers_select" ON public.customers FOR SELECT USING ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING ( organization_id = public.get_user_organization_id() )';
  END IF;
END $$;

-- =====================================================
-- PASSO 8: Políticas para APPOINTMENTS (se existir)
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    EXECUTE 'CREATE POLICY "appointments_select" ON public.appointments FOR SELECT USING ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING ( organization_id = public.get_user_organization_id() )';
    EXECUTE 'CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE USING ( organization_id = public.get_user_organization_id() )';
  END IF;
END $$;

-- =====================================================
-- PRONTO! Após executar, faça logout e login novamente.
-- =====================================================
