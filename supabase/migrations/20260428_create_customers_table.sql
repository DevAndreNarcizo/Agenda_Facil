-- Cria e padroniza a tabela de clientes usada pelo CRM, portal e agendamentos.
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT customers_phone_not_blank CHECK (length(trim(phone)) > 0),
  CONSTRAINT customers_email_valid CHECK (
    email IS NULL
    OR email = ''
    OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.customers
SET organization_id = COALESCE(organization_id, company_id),
    company_id = COALESCE(company_id, organization_id)
WHERE organization_id IS NULL
   OR company_id IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_organization_phone_unique
  ON public.customers (organization_id, phone);

CREATE INDEX IF NOT EXISTS idx_customers_organization_name
  ON public.customers (organization_id, name);

CREATE INDEX IF NOT EXISTS idx_customers_created_at
  ON public.customers (created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_customer_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := COALESCE(NEW.organization_id, NEW.company_id);
  NEW.company_id := COALESCE(NEW.company_id, NEW.organization_id);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_customer_company_id ON public.customers;
CREATE TRIGGER trigger_sync_customer_company_id
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_company_id();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;

CREATE POLICY "customers_select" ON public.customers
  FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE
  USING (organization_id = public.get_user_organization_id());

CREATE OR REPLACE FUNCTION public.verify_otp(phone_number text, input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_code record;
  customer_record record;
BEGIN
  SELECT * INTO record_code
  FROM verification_codes
  WHERE phone = phone_number
    AND code = input_code
    AND expires_at > now();

  IF record_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código inválido ou expirado');
  END IF;

  DELETE FROM verification_codes WHERE id = record_code.id;

  SELECT * INTO customer_record
  FROM customers
  WHERE phone = phone_number
  ORDER BY created_at DESC
  LIMIT 1;

  IF customer_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', customer_record.id,
      'name', customer_record.name,
      'phone', customer_record.phone,
      'organization_id', customer_record.organization_id
    )
  );
END;
$$;

COMMENT ON TABLE public.customers IS 'Clientes do CRM vinculados a uma organização.';
COMMENT ON FUNCTION public.sync_customer_company_id IS 'Mantém company_id compatível com organization_id para scripts legados.';
