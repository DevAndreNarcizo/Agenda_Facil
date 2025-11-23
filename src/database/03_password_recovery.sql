-- Password Recovery System for Dashboard Users
-- This allows users to reset their password via email

-- Create table for password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Function to request password reset
CREATE OR REPLACE FUNCTION request_password_reset(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  reset_token TEXT;
  expiry_time TIMESTAMPTZ;
BEGIN
  -- Find user by email
  SELECT id, email INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    -- Don't reveal if email exists or not (security best practice)
    RETURN jsonb_build_object('success', true, 'message', 'Se o email existir, você receberá instruções de recuperação');
  END IF;

  -- Generate secure random token
  reset_token := encode(gen_random_bytes(32), 'hex');
  expiry_time := NOW() + INTERVAL '1 hour';

  -- Invalidate previous tokens for this user
  UPDATE password_reset_tokens 
  SET used = TRUE 
  WHERE user_id = user_record.id AND used = FALSE;

  -- Insert new token
  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (user_record.id, reset_token, expiry_time);

  -- In production, trigger an Edge Function to send email
  -- For now, return the token for testing
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Se o email existir, você receberá instruções de recuperação',
    'simulated_token', reset_token,
    'simulated_link', 'http://localhost:5173/reset-password?token=' || reset_token
  );
END;
$$;

-- Function to verify reset token
CREATE OR REPLACE FUNCTION verify_reset_token(reset_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Check if token exists and is valid
  SELECT * INTO token_record
  FROM password_reset_tokens
  WHERE token = reset_token
    AND used = FALSE
    AND expires_at > NOW();

  IF token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Token inválido ou expirado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', token_record.user_id
  );
END;
$$;

-- Function to complete password reset
CREATE OR REPLACE FUNCTION complete_password_reset(reset_token TEXT, new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Verify token
  SELECT * INTO token_record
  FROM password_reset_tokens
  WHERE token = reset_token
    AND used = FALSE
    AND expires_at > NOW();

  IF token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Token inválido ou expirado');
  END IF;

  -- Mark token as used
  UPDATE password_reset_tokens
  SET used = TRUE
  WHERE id = token_record.id;

  -- Update user password using Supabase Auth
  -- Note: This requires admin privileges, so we'll use a different approach
  -- The frontend should use supabase.auth.updateUser() instead
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Token validado. Use supabase.auth.updateUser() no frontend',
    'user_id', token_record.user_id
  );
END;
$$;

-- Add comment
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for dashboard users';
