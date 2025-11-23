-- Update request_otp function to call Edge Function for real WhatsApp sending
CREATE OR REPLACE FUNCTION request_otp(phone_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_code TEXT;
  expiry_time TIMESTAMPTZ;
  edge_function_response JSONB;
BEGIN
  -- Generate a 6-digit code
  generated_code := floor(random() * (999999 - 100000 + 1) + 100000)::TEXT;
  expiry_time := NOW() + INTERVAL '5 minutes';

  -- Invalidate previous codes for this phone
  DELETE FROM verification_codes WHERE phone = phone_number;

  -- Insert new code
  INSERT INTO verification_codes (phone, code, expires_at)
  VALUES (phone_number, generated_code, expiry_time);

  -- Call Edge Function to send WhatsApp message
  BEGIN
    SELECT content::jsonb INTO edge_function_response
    FROM http((
      'POST',
      current_setting('app.settings.supabase_url') || '/functions/v1/send-whatsapp',
      ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key'))],
      'application/json',
      jsonb_build_object(
        'phone', phone_number,
        'code', generated_code,
        'type', 'otp'
      )::text
    )::http_request);

    -- Check if sending was successful
    IF edge_function_response->>'success' = 'true' THEN
      RETURN jsonb_build_object(
        'success', true, 
        'message', 'Código enviado via WhatsApp'
      );
    ELSE
      -- If Edge Function fails, return simulated response for development
      RETURN jsonb_build_object(
        'success', true, 
        'message', 'Código gerado (WhatsApp indisponível)',
        'simulated_code', generated_code
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If http extension is not available or Edge Function fails, return simulated response
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Código gerado (modo desenvolvimento)',
      'simulated_code', generated_code
    );
  END;
END;
$$;
