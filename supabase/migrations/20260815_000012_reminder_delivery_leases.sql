-- Leases com token para impedir que workers expirados finalizem ou enviem entregas reivindicadas por outra execução.

ALTER TABLE public.message_deliveries
  ADD COLUMN IF NOT EXISTS lock_token uuid,
  ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz;

-- Entregas em processamento da versão anterior tornam-se imediatamente recuperáveis.
UPDATE public.message_deliveries
SET
  lock_token = COALESCE(lock_token, gen_random_uuid()),
  lock_expires_at = COALESCE(lock_expires_at, now() - interval '1 second')
WHERE status = 'processing';

ALTER TABLE public.message_deliveries
  DROP CONSTRAINT IF EXISTS message_deliveries_processing_lease;

ALTER TABLE public.message_deliveries
  ADD CONSTRAINT message_deliveries_processing_lease
  CHECK (
    (status = 'processing') = (lock_token IS NOT NULL AND lock_expires_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_message_deliveries_reminder_lease_expiry
  ON public.message_deliveries (lock_expires_at)
  WHERE channel = 'whatsapp'
    AND template_name = 'appointment_reminder'
    AND status = 'processing';

DROP FUNCTION public.complete_reminder_delivery(uuid, uuid, uuid, text);
DROP FUNCTION private.complete_reminder_delivery(uuid, uuid, uuid, text);
DROP FUNCTION public.claim_reminder_deliveries(integer, interval);
DROP FUNCTION private.claim_reminder_deliveries(integer, interval);
DROP FUNCTION public.mark_message_delivery(uuid, text, text, text);
DROP FUNCTION private.mark_message_delivery(uuid, text, text, text);

CREATE OR REPLACE FUNCTION private.claim_reminder_deliveries(
  p_limit integer DEFAULT 25,
  p_lock_ttl interval DEFAULT interval '10 minutes'
)
RETURNS SETOF public.message_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Limite de lote inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_lock_ttl < interval '7 minutes 30 seconds' OR p_lock_ttl > interval '1 hour' THEN
    RAISE EXCEPTION 'TTL de lock inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.message_deliveries
  SET
    status = 'failed',
    locked_at = NULL,
    lock_token = NULL,
    lock_expires_at = NULL,
    last_error_code = 'processing_timeout',
    next_attempt_at = now(),
    updated_at = now()
  WHERE status = 'processing'
    AND channel = 'whatsapp'
    AND template_name = 'appointment_reminder'
    AND lock_expires_at <= now();

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.message_deliveries
    WHERE status IN ('pending', 'failed')
      AND channel = 'whatsapp'
      AND template_name = 'appointment_reminder'
      AND scheduled_for <= now()
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
      lock_token = gen_random_uuid(),
      lock_expires_at = now() + p_lock_ttl,
      last_error_code = NULL,
      updated_at = now()
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.*
  )
  SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION private.renew_reminder_delivery_lease(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_lock_ttl interval DEFAULT interval '10 minutes'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_lock_ttl < interval '7 minutes 30 seconds' OR p_lock_ttl > interval '1 hour' THEN
    RAISE EXCEPTION 'TTL de lock inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.message_deliveries
  SET
    locked_at = now(),
    lock_expires_at = now() + p_lock_ttl,
    updated_at = now()
  WHERE id = p_delivery_id
    AND lock_token = p_lock_token
    AND status = 'processing'
    AND lock_expires_at > now();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_reminder_delivery(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_status text,
  p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('failed', 'unknown', 'skipped') THEN
    RAISE EXCEPTION 'Estado final de entrega inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.message_deliveries
  SET
    status = p_status,
    locked_at = NULL,
    lock_token = NULL,
    lock_expires_at = NULL,
    last_error_code = left(COALESCE(p_error_code, 'delivery_error'), 80),
    next_attempt_at = CASE
      WHEN p_status = 'failed' AND attempts < max_attempts
        THEN now() + LEAST(interval '1 hour', interval '30 seconds' * power(2, GREATEST(attempts - 1, 0)))
      ELSE next_attempt_at
    END,
    updated_at = now()
  WHERE id = p_delivery_id
    AND lock_token = p_lock_token
    AND status = 'processing'
    AND lock_expires_at > now();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_reminder_delivery(
  p_delivery_id uuid,
  p_appointment_id uuid,
  p_organization_id uuid,
  p_lock_token uuid,
  p_provider_message_id text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment_status text;
BEGIN
  PERFORM 1
  FROM public.message_deliveries
  WHERE id = p_delivery_id
    AND appointment_id = p_appointment_id
    AND organization_id = p_organization_id
    AND channel = 'whatsapp'
    AND template_name = 'appointment_reminder'
    AND lock_token = p_lock_token
    AND lock_expires_at > now()
    AND status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease de entrega inválido ou expirado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_appointment_status
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND OR v_appointment_status <> 'confirmed' THEN
    UPDATE public.message_deliveries
    SET
      status = 'unknown',
      locked_at = NULL,
      lock_token = NULL,
      lock_expires_at = NULL,
      last_error_code = 'appointment_not_confirmed_after_send',
      updated_at = now()
    WHERE id = p_delivery_id;

    RETURN 'unknown';
  END IF;

  UPDATE public.appointments
  SET reminder_sent_at = now()
  WHERE id = p_appointment_id
    AND organization_id = p_organization_id;

  UPDATE public.message_deliveries
  SET
    status = 'sent',
    sent_at = now(),
    locked_at = NULL,
    lock_token = NULL,
    lock_expires_at = NULL,
    last_error_code = NULL,
    provider_message_id = left(NULLIF(p_provider_message_id, ''), 255),
    updated_at = now()
  WHERE id = p_delivery_id;

  RETURN 'sent';
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_reminder_deliveries(
  p_limit integer DEFAULT 25,
  p_lock_ttl interval DEFAULT interval '10 minutes'
)
RETURNS SETOF public.message_deliveries
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT * FROM private.claim_reminder_deliveries(p_limit, p_lock_ttl);
$$;

CREATE OR REPLACE FUNCTION public.renew_reminder_delivery_lease(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_lock_ttl interval DEFAULT interval '10 minutes'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.renew_reminder_delivery_lease(p_delivery_id, p_lock_token, p_lock_ttl);
$$;

CREATE OR REPLACE FUNCTION public.mark_reminder_delivery(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_status text,
  p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.mark_reminder_delivery(p_delivery_id, p_lock_token, p_status, p_error_code);
$$;

CREATE OR REPLACE FUNCTION public.complete_reminder_delivery(
  p_delivery_id uuid,
  p_appointment_id uuid,
  p_organization_id uuid,
  p_lock_token uuid,
  p_provider_message_id text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.complete_reminder_delivery(
    p_delivery_id,
    p_appointment_id,
    p_organization_id,
    p_lock_token,
    p_provider_message_id
  );
$$;

REVOKE ALL ON FUNCTION private.claim_reminder_deliveries(integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.renew_reminder_delivery_lease(uuid, uuid, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mark_reminder_delivery(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.complete_reminder_delivery(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_reminder_deliveries(integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_reminder_delivery_lease(uuid, uuid, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_reminder_delivery(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_reminder_delivery(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.claim_reminder_deliveries(integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION private.renew_reminder_delivery_lease(uuid, uuid, interval) TO service_role;
GRANT EXECUTE ON FUNCTION private.mark_reminder_delivery(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.complete_reminder_delivery(uuid, uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_reminder_deliveries(integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_reminder_delivery_lease(uuid, uuid, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_reminder_delivery(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_reminder_delivery(uuid, uuid, uuid, uuid, text) TO service_role;
