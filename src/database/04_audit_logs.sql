-- Audit Logs System
-- Tracks all important changes in the system for security and compliance

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL, -- 'appointments', 'customers', 'services', etc
  record_id UUID, -- ID of the affected record
  old_data JSONB, -- Previous state (for updates/deletes)
  new_data JSONB, -- New state (for creates/updates)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_organization_id UUID,
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    organization_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_action,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- Trigger function for appointments
CREATE OR REPLACE FUNCTION audit_appointments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM log_audit_event(
      auth.uid(),
      OLD.organization_id,
      'delete',
      'appointments',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_audit_event(
      auth.uid(),
      NEW.organization_id,
      'update',
      'appointments',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM log_audit_event(
      auth.uid(),
      NEW.organization_id,
      'create',
      'appointments',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger function for customers
CREATE OR REPLACE FUNCTION audit_customers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM log_audit_event(
      auth.uid(),
      OLD.organization_id,
      'delete',
      'customers',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_audit_event(
      auth.uid(),
      NEW.organization_id,
      'update',
      'customers',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM log_audit_event(
      auth.uid(),
      NEW.organization_id,
      'create',
      'customers',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger function for services
CREATE OR REPLACE FUNCTION audit_services()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM log_audit_event(
      auth.uid(),
      OLD.organization_id,
      'delete',
      'services',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_audit_event(
      auth.uid(),
      NEW.organization_id,
      'update',
      'services',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM log_audit_event(
      auth.uid(),
      NEW.organization_id,
      'create',
      'services',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_audit_appointments ON appointments;
CREATE TRIGGER trigger_audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION audit_appointments();

DROP TRIGGER IF EXISTS trigger_audit_customers ON customers;
CREATE TRIGGER trigger_audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_customers();

DROP TRIGGER IF EXISTS trigger_audit_services ON services;
CREATE TRIGGER trigger_audit_services
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION audit_services();

-- Add comments
COMMENT ON TABLE audit_logs IS 'Stores audit trail of all important changes in the system';
COMMENT ON FUNCTION log_audit_event IS 'Logs an audit event to the audit_logs table';
