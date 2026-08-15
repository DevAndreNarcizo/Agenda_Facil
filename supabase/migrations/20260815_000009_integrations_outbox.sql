-- Agenda Fácil: outbox e ledger transacional para integrações externas.
-- Nenhum telefone, OTP, corpo de mensagem ou token é persistido nesta estrutura.

CREATE TABLE IF NOT EXISTS public.message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp')),
  template_name text NOT NULL CHECK (template_name IN ('appointment_reminder', 'appointment_confirmation', 'portal_otp')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'unknown')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  scheduled_for timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_deliveries_unique_appointment_template UNIQUE (appointment_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_claim
  ON public.message_deliveries (status, next_attempt_at, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_organization_id
  ON public.message_deliveries (organization_id);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_appointment_id
  ON public.message_deliveries (appointment_id);

ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_deliveries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.message_deliveries TO service_role;

DROP POLICY IF EXISTS message_deliveries_service_role_only ON public.message_deliveries;
CREATE POLICY message_deliveries_service_role_only ON public.message_deliveries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_status_valid'
  ) THEN
    ALTER TABLE public.webhook_events
      ADD CONSTRAINT webhook_events_status_valid
      CHECK (status IN ('processing', 'processed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_events_retry
  ON public.webhook_events (provider, status, updated_at);

CREATE OR REPLACE FUNCTION private.claim_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_stale_after interval DEFAULT interval '10 minutes'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF length(trim(p_provider)) = 0 OR length(trim(p_provider_event_id)) = 0 OR length(trim(p_event_type)) = 0 THEN
    RAISE EXCEPTION 'Evento de webhook inválido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.webhook_events (
    provider,
    provider_event_id,
    event_type,
    status,
    attempts,
    received_at,
    updated_at
  ) VALUES (
    trim(p_provider),
    trim(p_provider_event_id),
    trim(p_event_type),
    'processing',
    1,
    now(),
    now()
  ) ON CONFLICT (provider, provider_event_id) DO NOTHING;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  UPDATE public.webhook_events
  SET
    status = 'processing',
    attempts = attempts + 1,
    last_error_code = NULL,
    updated_at = now()
  WHERE provider = trim(p_provider)
    AND provider_event_id = trim(p_provider_event_id)
    AND (
      status = 'failed'
      OR (status = 'processing' AND updated_at < now() - p_stale_after)
    );

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO v_status
  FROM public.webhook_events
  WHERE provider = trim(p_provider)
    AND provider_event_id = trim(p_provider_event_id);

  RETURN COALESCE(v_status, 'processing');
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_status text,
  p_error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('processed', 'failed') THEN
    RAISE EXCEPTION 'Estado final de webhook inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.webhook_events
  SET
    status = p_status,
    last_error_code = CASE
      WHEN p_status = 'failed' THEN left(COALESCE(p_error_code, 'processing_error'), 80)
      ELSE NULL
    END,
    processed_at = CASE WHEN p_status = 'processed' THEN now() ELSE processed_at END,
    updated_at = now()
  WHERE provider = trim(p_provider)
    AND provider_event_id = trim(p_provider_event_id)
    AND status = 'processing';
END;
$$;

CREATE OR REPLACE FUNCTION private.claim_message_deliveries(p_limit integer DEFAULT 25)
RETURNS SETOF public.message_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Limite de lote inválido.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.message_deliveries
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= now()
      AND attempts < max_attempts
    ORDER BY scheduled_for, created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.message_deliveries AS delivery
    SET
      status = 'processing',
      attempts = delivery.attempts + 1,
      locked_at = now(),
      updated_at = now()
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.*
  )
  SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_message_delivery(
  p_delivery_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'Estado final de entrega inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.message_deliveries
  SET
    status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    locked_at = NULL,
    last_error_code = CASE WHEN p_status = 'failed' THEN left(COALESCE(p_error_code, 'delivery_error'), 80) ELSE NULL END,
    provider_message_id = CASE WHEN p_status = 'sent' THEN left(NULLIF(p_provider_message_id, ''), 255) ELSE provider_message_id END,
    next_attempt_at = CASE
      WHEN p_status = 'failed' AND attempts < max_attempts
        THEN now() + LEAST(interval '1 hour', interval '30 seconds' * power(2, GREATEST(attempts - 1, 0)))
      ELSE next_attempt_at
    END,
    updated_at = now()
  WHERE id = p_delivery_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION private.claim_webhook_event(text, text, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mark_webhook_event(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.claim_message_deliveries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mark_message_delivery(uuid, text, text, text) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.claim_webhook_event(text, text, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION private.mark_webhook_event(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.claim_message_deliveries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.mark_message_delivery(uuid, text, text, text) TO service_role;
