-- Cobre a FK de bloqueios por profissional apontada pelo Performance Advisor.
-- @author André Narcizo

CREATE INDEX IF NOT EXISTS idx_appointment_blocks_employee_id
  ON public.appointment_blocks (employee_id);
