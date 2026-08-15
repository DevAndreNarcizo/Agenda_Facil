-- Fecha explicitamente o acesso Data API e indexa FKs do Portal do Cliente.
-- @author André Narcizo

CREATE INDEX IF NOT EXISTS idx_portal_otp_challenges_customer_id
  ON public.portal_otp_challenges (customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_otp_challenges_organization_id
  ON public.portal_otp_challenges (organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer_id
  ON public.portal_sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_organization_id
  ON public.portal_sessions (organization_id);

CREATE POLICY portal_otp_requests_deny_data_api ON public.portal_otp_requests
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY portal_otp_challenges_deny_data_api ON public.portal_otp_challenges
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY portal_sessions_deny_data_api ON public.portal_sessions
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
