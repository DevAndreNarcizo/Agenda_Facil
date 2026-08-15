-- Wrappers públicos controlados: Edge Functions acessam o Data API apenas no schema public.
-- As implementações permanecem privadas e só service_role pode invocar os wrappers.

CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_stale_after interval DEFAULT interval '10 minutes'
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.claim_webhook_event(p_provider, p_provider_event_id, p_event_type, p_stale_after);
$$;

CREATE OR REPLACE FUNCTION public.mark_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_status text,
  p_error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.mark_webhook_event(p_provider, p_provider_event_id, p_status, p_error_code);
$$;

CREATE OR REPLACE FUNCTION public.claim_message_deliveries(p_limit integer DEFAULT 25)
RETURNS SETOF public.message_deliveries
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT * FROM private.claim_message_deliveries(p_limit);
$$;

CREATE OR REPLACE FUNCTION public.mark_message_delivery(
  p_delivery_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.mark_message_delivery(p_delivery_id, p_status, p_error_code, p_provider_message_id);
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(text, text, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_webhook_event(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_message_deliveries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_message_delivery(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(text, text, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_webhook_event(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_message_deliveries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_message_delivery(uuid, text, text, text) TO service_role;
