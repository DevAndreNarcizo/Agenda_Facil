-- Create table for storing verification codes
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone);

-- Function to request an OTP (Simulated sending)
CREATE OR REPLACE FUNCTION request_otp(phone_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_code TEXT;
  expiry_time TIMESTAMPTZ;
BEGIN
  -- Generate a 6-digit code
  generated_code := floor(random() * (999999 - 100000 + 1) + 100000)::TEXT;
  expiry_time := NOW() + INTERVAL '5 minutes';

  -- Invalidate previous codes for this phone
  DELETE FROM verification_codes WHERE phone = phone_number;

  -- Insert new code
  INSERT INTO verification_codes (phone, code, expires_at)
  VALUES (phone_number, generated_code, expiry_time);

  -- Return the code so the frontend can "simulate" sending it (since we don't have WhatsApp API yet)
  -- In production, you would NOT return the code here, but trigger an Edge Function to send it.
  RETURN jsonb_build_object('success', true, 'message', 'Código enviado', 'simulated_code', generated_code);
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(phone_number TEXT, input_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  record_code RECORD;
  customer_record RECORD;
BEGIN
  -- Check if code exists and is valid
  SELECT * INTO record_code
  FROM verification_codes
  WHERE phone = phone_number
    AND code = input_code
    AND expires_at > NOW();

  IF record_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código inválido ou expirado');
  END IF;

  -- Code is valid, delete it (consume)
  DELETE FROM verification_codes WHERE id = record_code.id;

  -- Find or create customer (optional: for now just find)
  SELECT * INTO customer_record FROM customers WHERE phone = phone_number LIMIT 1;

  IF customer_record IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'customer', jsonb_build_object(
      'id', customer_record.id,
      'name', customer_record.name,
      'organization_id', customer_record.organization_id
    )
  );
END;
$$;
