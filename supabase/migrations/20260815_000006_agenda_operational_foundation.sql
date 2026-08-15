-- Fundações de disponibilidade e concorrência para a agenda operacional.
-- @author André Narcizo

CREATE TABLE IF NOT EXISTS public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointment_blocks_tenant_isolation ON public.appointment_blocks
  FOR ALL TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()))
  WITH CHECK (organization_id = (SELECT private.current_organization_id()));

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_organization_time_no_overlap;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_employee_time_no_overlap
  EXCLUDE USING gist (organization_id WITH =, employee_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
  WHERE (employee_id IS NOT NULL AND status IN ('pending', 'confirmed'));
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_org_time_no_overlap_without_employee
  EXCLUDE USING gist (organization_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
  WHERE (employee_id IS NULL AND status IN ('pending', 'confirmed'));
