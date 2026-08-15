-- Teste transacional da fundação de reserva pública da SPEC-007.
-- Execute somente no Supabase de teste com role administrativa.
-- @author André Narcizo

BEGIN;

INSERT INTO public.organizations (id, name, slug)
VALUES ('70000000-0000-4000-8000-000000000001', 'Reserva pública teste', 'reserva-publica-teste');

INSERT INTO public.organization_settings (organization_id, timezone)
VALUES ('70000000-0000-4000-8000-000000000001', 'America/Sao_Paulo');

INSERT INTO public.organization_business_hours (organization_id, day_of_week, is_active, start_time, end_time)
SELECT '70000000-0000-4000-8000-000000000001', day_of_week, true, '08:00', '18:00'
FROM generate_series(0, 6) AS day_of_week;

INSERT INTO public.services (id, duration_minutes, is_active, name, organization_id, price)
VALUES ('70000000-0000-4000-8000-000000000002', 30, true, 'Serviço público', '70000000-0000-4000-8000-000000000001', 75);

INSERT INTO public.customers (id, name, organization_id, phone)
VALUES ('70000000-0000-4000-8000-000000000003', 'Cliente público', '70000000-0000-4000-8000-000000000001', '62999999999');

INSERT INTO public.portal_sessions (id, customer_id, expires_at, organization_id, token_hash)
VALUES (
  '70000000-0000-4000-8000-000000000004',
  '70000000-0000-4000-8000-000000000003',
  now() + interval '1 hour',
  '70000000-0000-4000-8000-000000000001',
  'test-token-hash-public-booking'
);

INSERT INTO public.public_booking_settings (allowed_employee_ids, allowed_service_ids, is_enabled, organization_id)
VALUES (
  '{}'::uuid[],
  ARRAY['70000000-0000-4000-8000-000000000002'::uuid],
  true,
  '70000000-0000-4000-8000-000000000001'
);

DO $$
DECLARE
  v_context jsonb;
  v_slots jsonb;
  v_booking jsonb;
  v_start_time timestamptz := ((current_date + 1)::date + time '12:00') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  v_context := public.get_public_booking_context('reserva-publica-teste');
  IF jsonb_array_length(v_context -> 'services') <> 1 THEN
    RAISE EXCEPTION 'Contexto público não respeitou o catálogo permitido.';
  END IF;

  v_slots := public.get_public_available_slots(
    'reserva-publica-teste',
    '70000000-0000-4000-8000-000000000002',
    current_date + 1,
    NULL
  );
  IF jsonb_array_length(v_slots) = 0 THEN
    RAISE EXCEPTION 'Disponibilidade pública não retornou slots válidos.';
  END IF;

  v_booking := public.create_public_booking(
    '70000000-0000-4000-8000-000000000004',
    'reserva-publica-teste',
    '70000000-0000-4000-8000-000000000002',
    v_start_time,
    NULL,
    'instagram'
  );
  IF (v_booking -> 'appointment' ->> 'status') <> 'pending' THEN
    RAISE EXCEPTION 'Reserva pública não foi criada como pendente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id = (v_booking -> 'appointment' ->> 'id')::uuid
      AND booking_source = 'instagram'
  ) THEN
    RAISE EXCEPTION 'Origem de aquisição não foi persistida.';
  END IF;

  BEGIN
    PERFORM public.create_public_booking(
      '70000000-0000-4000-8000-000000000004',
      'reserva-publica-teste',
      '70000000-0000-4000-8000-000000000002',
      v_start_time,
      NULL,
      'site'
    );
    RAISE EXCEPTION 'Conflito de reserva pública foi aceito.';
  EXCEPTION
    WHEN SQLSTATE '23P01' THEN NULL;
  END;

END;
$$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.get_public_booking_context('reserva-publica-teste');
    RAISE EXCEPTION 'Browser autenticado chamou RPC pública diretamente.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;
