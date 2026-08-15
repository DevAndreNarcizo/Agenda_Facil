-- Otimiza avaliação de RLS e remove índice duplicado.
-- @author André Narcizo

DROP POLICY IF EXISTS profiles_select_same_organization ON public.profiles;
CREATE POLICY profiles_select_same_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR organization_id = (SELECT private.current_organization_id())
  );

DROP POLICY IF EXISTS profiles_insert_self_without_organization ON public.profiles;
CREATE POLICY profiles_insert_self_without_organization ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND organization_id IS NULL
  );

DROP INDEX IF EXISTS public.idx_appointments_org_start_time;
