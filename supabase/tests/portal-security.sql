-- Teste transacional: dados sensíveis do portal não podem ser acessados pela Data API.
-- @author André Narcizo

BEGIN;
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.portal_otp_requests (phone_hash, ip_hash)
    VALUES ('test-phone-hash', 'test-ip-hash');

    RAISE EXCEPTION 'Falha: usuário autenticado inseriu rate limit do portal diretamente';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    SELECT count(*) FROM public.portal_sessions;

    RAISE EXCEPTION 'Falha: usuário autenticado consultou sessões de portal diretamente';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
