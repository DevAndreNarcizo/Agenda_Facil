BEGIN;

DO $$
DECLARE
  v_organization_id uuid;
  v_appointment_id uuid;
  v_delivery_id uuid;
  v_claimed_delivery_id uuid;
  v_status text;
BEGIN
  INSERT INTO public.organizations (name, slug)
  VALUES ('Integrações Teste', 'integracoes-teste-' || substr(gen_random_uuid()::text, 1, 8))
  RETURNING id INTO v_organization_id;

  INSERT INTO public.appointments (organization_id, start_time, end_time, status)
  VALUES (v_organization_id, now() + interval '2 days', now() + interval '2 days 30 minutes', 'confirmed')
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.message_deliveries (organization_id, appointment_id, channel, template_name, scheduled_for)
  VALUES (v_organization_id, v_appointment_id, 'whatsapp', 'appointment_reminder', now())
  RETURNING id INTO v_delivery_id;

  BEGIN
    INSERT INTO public.message_deliveries (organization_id, appointment_id, channel, template_name, scheduled_for)
    VALUES (v_organization_id, v_appointment_id, 'whatsapp', 'appointment_reminder', now());
    RAISE EXCEPTION 'A outbox aceitou entrega duplicada.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  SELECT id INTO v_claimed_delivery_id FROM public.claim_message_deliveries(1);
  IF v_claimed_delivery_id IS DISTINCT FROM v_delivery_id THEN
    RAISE EXCEPTION 'Claim da outbox não retornou a entrega esperada.';
  END IF;

  IF (SELECT status FROM public.message_deliveries WHERE id = v_delivery_id) <> 'processing' THEN
    RAISE EXCEPTION 'Claim não marcou a entrega como processing.';
  END IF;

  PERFORM public.mark_message_delivery(v_delivery_id, 'failed', 'provider_422', NULL);
  IF (SELECT status FROM public.message_deliveries WHERE id = v_delivery_id) <> 'failed' THEN
    RAISE EXCEPTION 'Falha não foi registrada na outbox.';
  END IF;

  UPDATE public.message_deliveries SET next_attempt_at = now() WHERE id = v_delivery_id;
  PERFORM public.claim_message_deliveries(1);
  PERFORM public.mark_message_delivery(v_delivery_id, 'sent', NULL, 'wamid.test');
  IF (SELECT status FROM public.message_deliveries WHERE id = v_delivery_id) <> 'sent' THEN
    RAISE EXCEPTION 'Entrega não foi finalizada como enviada.';
  END IF;

  v_status := public.claim_webhook_event('stripe', 'evt_test_001', 'checkout.session.completed');
  IF v_status <> 'claimed' THEN
    RAISE EXCEPTION 'Primeiro webhook não foi reivindicado.';
  END IF;

  v_status := public.claim_webhook_event('stripe', 'evt_test_001', 'checkout.session.completed');
  IF v_status <> 'processing' THEN
    RAISE EXCEPTION 'Webhook concorrente não foi preservado em processing.';
  END IF;

  PERFORM public.mark_webhook_event('stripe', 'evt_test_001', 'processed', NULL);
  v_status := public.claim_webhook_event('stripe', 'evt_test_001', 'checkout.session.completed');
  IF v_status <> 'processed' THEN
    RAISE EXCEPTION 'Webhook entregue novamente não foi reconhecido como processado.';
  END IF;

  IF has_table_privilege('authenticated', 'public.message_deliveries', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated ainda pode ler a outbox.';
  END IF;

  IF has_function_privilege('authenticated', 'public.claim_message_deliveries(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated ainda pode executar claim da outbox.';
  END IF;
END;
$$;

ROLLBACK;
