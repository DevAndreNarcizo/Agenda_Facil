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
  v_first_lock_token uuid;
  v_second_lock_token uuid;
  v_cancelled_lock_token uuid;
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

  SELECT id, lock_token INTO v_claimed_delivery_id, v_first_lock_token
  FROM public.claim_reminder_deliveries(1, interval '450 seconds');
  IF v_claimed_delivery_id IS DISTINCT FROM v_reminder_delivery_id OR v_first_lock_token IS NULL THEN
    RAISE EXCEPTION 'Claim de lembrete não criou lease para a entrega esperada.';
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
  SET lock_expires_at = now() - interval '1 second'
  WHERE id = v_reminder_delivery_id;

  SELECT id, lock_token INTO v_claimed_delivery_id, v_second_lock_token
  FROM public.claim_reminder_deliveries(1, interval '450 seconds');
  IF v_claimed_delivery_id IS DISTINCT FROM v_reminder_delivery_id
    OR v_second_lock_token IS NULL
    OR v_second_lock_token = v_first_lock_token THEN
    RAISE EXCEPTION 'Lock abandonado não recebeu um novo lease.';
  END IF;

  IF public.mark_reminder_delivery(
    v_reminder_delivery_id,
    v_first_lock_token,
    'failed',
    'stale_worker'
  ) THEN
    RAISE EXCEPTION 'Worker com lease expirado conseguiu finalizar entrega nova.';
  END IF;

  IF NOT public.renew_reminder_delivery_lease(
    v_reminder_delivery_id,
    v_second_lock_token,
    interval '450 seconds'
  ) THEN
    RAISE EXCEPTION 'Lease atual não foi renovado antes do envio.';
  END IF;

  v_status := public.complete_reminder_delivery(
    v_reminder_delivery_id,
    v_reminder_appointment_id,
    v_organization_id,
    v_second_lock_token,
    'wamid.test'
  );
  IF v_status <> 'sent' THEN
    RAISE EXCEPTION 'Finalização atômica não retornou sent.';
  END IF;

  IF (SELECT status FROM public.message_deliveries WHERE id = v_reminder_delivery_id) <> 'sent'
    OR (SELECT reminder_sent_at IS NULL FROM public.appointments WHERE id = v_reminder_appointment_id)
    OR (SELECT lock_token IS NOT NULL OR lock_expires_at IS NOT NULL FROM public.message_deliveries WHERE id = v_reminder_delivery_id) THEN
    RAISE EXCEPTION 'Finalização atômica não confirmou entrega, agendamento e limpeza do lease.';
  END IF;

  SELECT id, lock_token INTO v_claimed_delivery_id, v_cancelled_lock_token
  FROM public.claim_reminder_deliveries(1, interval '450 seconds');
  IF v_claimed_delivery_id IS DISTINCT FROM v_cancelled_delivery_id THEN
    RAISE EXCEPTION 'Claim não disponibilizou entrega cancelada para descarte pelo worker.';
  END IF;

  IF NOT public.mark_reminder_delivery(
    v_cancelled_delivery_id,
    v_cancelled_lock_token,
    'skipped',
    'appointment_not_confirmed'
  ) THEN
    RAISE EXCEPTION 'Entrega cancelada não foi encerrada pelo lease atual.';
  END IF;

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
