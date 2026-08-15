BEGIN;

DO $$
DECLARE
  v_organization_id uuid;
  v_reminder_appointment_id uuid;
  v_cancelled_appointment_id uuid;
  v_confirmation_appointment_id uuid;
  v_reminder_delivery_id uuid;
  v_cancelled_delivery_id uuid;
  v_confirmation_delivery_id uuid;
  v_claimed_delivery_id uuid;
  v_status text;
BEGIN
  INSERT INTO public.organizations (name, slug)
  VALUES ('Integrações Teste', 'integracoes-teste-' || substr(gen_random_uuid()::text, 1, 8))
  RETURNING id INTO v_organization_id;

  INSERT INTO public.appointments (organization_id, start_time, end_time, status)
  VALUES (v_organization_id, now() + interval '2 days', now() + interval '2 days 30 minutes', 'confirmed')
  RETURNING id INTO v_reminder_appointment_id;

  INSERT INTO public.appointments (organization_id, start_time, end_time, status)
  VALUES (v_organization_id, now() + interval '3 days', now() + interval '3 days 30 minutes', 'cancelled')
  RETURNING id INTO v_cancelled_appointment_id;

  INSERT INTO public.appointments (organization_id, start_time, end_time, status)
  VALUES (v_organization_id, now() + interval '4 days', now() + interval '4 days 30 minutes', 'confirmed')
  RETURNING id INTO v_confirmation_appointment_id;

  INSERT INTO public.message_deliveries (organization_id, appointment_id, channel, template_name, scheduled_for)
  VALUES (v_organization_id, v_reminder_appointment_id, 'whatsapp', 'appointment_reminder', now() - interval '3 minutes')
  RETURNING id INTO v_reminder_delivery_id;

  INSERT INTO public.message_deliveries (organization_id, appointment_id, channel, template_name, scheduled_for)
  VALUES (v_organization_id, v_cancelled_appointment_id, 'whatsapp', 'appointment_reminder', now() - interval '2 minutes')
  RETURNING id INTO v_cancelled_delivery_id;

  INSERT INTO public.message_deliveries (organization_id, appointment_id, channel, template_name, scheduled_for)
  VALUES (v_organization_id, v_confirmation_appointment_id, 'whatsapp', 'appointment_confirmation', now() - interval '1 minute')
  RETURNING id INTO v_confirmation_delivery_id;

  BEGIN
    INSERT INTO public.message_deliveries (organization_id, appointment_id, channel, template_name, scheduled_for)
    VALUES (v_organization_id, v_reminder_appointment_id, 'whatsapp', 'appointment_reminder', now());
    RAISE EXCEPTION 'A outbox aceitou entrega duplicada.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  SELECT id INTO v_claimed_delivery_id
  FROM public.claim_reminder_deliveries(1, interval '1 minute');
  IF v_claimed_delivery_id IS DISTINCT FROM v_reminder_delivery_id THEN
    RAISE EXCEPTION 'Claim de lembrete não retornou a entrega esperada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.message_deliveries
    WHERE id = v_confirmation_delivery_id
      AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Claim de lembrete reivindicou template incompatível.';
  END IF;

  UPDATE public.message_deliveries
  SET locked_at = now() - interval '2 minutes'
  WHERE id = v_reminder_delivery_id;

  SELECT id INTO v_claimed_delivery_id
  FROM public.claim_reminder_deliveries(1, interval '1 minute');
  IF v_claimed_delivery_id IS DISTINCT FROM v_reminder_delivery_id THEN
    RAISE EXCEPTION 'Lock abandonado não foi recuperado pelo claim.';
  END IF;

  v_status := public.complete_reminder_delivery(
    v_reminder_delivery_id,
    v_reminder_appointment_id,
    v_organization_id,
    'wamid.test'
  );
  IF v_status <> 'sent' THEN
    RAISE EXCEPTION 'Finalização atômica não retornou sent.';
  END IF;

  IF (SELECT status FROM public.message_deliveries WHERE id = v_reminder_delivery_id) <> 'sent'
    OR (SELECT reminder_sent_at IS NULL FROM public.appointments WHERE id = v_reminder_appointment_id) THEN
    RAISE EXCEPTION 'Finalização atômica não confirmou entrega e agendamento.';
  END IF;

  SELECT id INTO v_claimed_delivery_id
  FROM public.claim_reminder_deliveries(1, interval '1 minute');
  IF v_claimed_delivery_id IS DISTINCT FROM v_cancelled_delivery_id THEN
    RAISE EXCEPTION 'Claim não disponibilizou entrega cancelada para descarte pelo worker.';
  END IF;

  PERFORM public.mark_message_delivery(v_cancelled_delivery_id, 'skipped', 'appointment_not_confirmed', NULL);
  IF (SELECT status FROM public.message_deliveries WHERE id = v_cancelled_delivery_id) <> 'skipped' THEN
    RAISE EXCEPTION 'Entrega de agendamento não confirmado não foi descartada.';
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

  IF has_function_privilege('authenticated', 'public.claim_reminder_deliveries(integer, interval)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated ainda pode executar claim de lembretes.';
  END IF;
END;
$$;

ROLLBACK;
