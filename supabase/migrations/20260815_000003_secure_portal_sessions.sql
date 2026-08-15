-- Implementa a persistência segura de OTP e sessões opacas do portal.
-- @author André Narcizo

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (regexp_replace(phone, '\D', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_customers_phone_normalized
  ON public.customers (phone_normalized);

CREATE TABLE IF NOT EXISTS public.portal_otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_otp_requests_phone_created
  ON public.portal_otp_requests (phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_otp_requests_ip_created
  ON public.portal_otp_requests (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS public.portal_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  code_hash text NOT NULL,
  ip_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_otp_challenges_phone_active
  ON public.portal_otp_challenges (phone_hash, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token_active
  ON public.portal_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.portal_otp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portal_otp_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.portal_otp_challenges FROM anon, authenticated;
REVOKE ALL ON TABLE public.portal_sessions FROM anon, authenticated;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_end_after_start CHECK (end_time > start_time);

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_organization_time_no_overlap
  EXCLUDE USING gist (
    organization_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));
