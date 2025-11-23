-- Migration to prevent double booking using exclusion constraints
-- This ensures that no two appointments can overlap for the same employee

-- First, we need to enable the btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint to prevent overlapping appointments for the same employee
-- This constraint ensures that for any given employee, no two appointments can have overlapping time ranges
ALTER TABLE appointments 
ADD CONSTRAINT no_overlapping_appointments_per_employee 
EXCLUDE USING GIST (
  employee_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status != 'cancelled');

-- Note: This constraint only applies when employee_id is NOT NULL
-- For appointments without a specific employee, we'll need a separate check

-- Add a similar constraint for organization-wide conflicts when no employee is specified
-- This prevents double booking when employee_id is NULL (any available employee)
ALTER TABLE appointments 
ADD CONSTRAINT no_overlapping_appointments_organization 
EXCLUDE USING GIST (
  organization_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status != 'cancelled' AND employee_id IS NULL);

-- Create an index to improve performance of availability checks
CREATE INDEX IF NOT EXISTS idx_appointments_time_range 
ON appointments USING GIST (tstzrange(start_time, end_time))
WHERE status != 'cancelled';

-- Add comment explaining the constraints
COMMENT ON CONSTRAINT no_overlapping_appointments_per_employee ON appointments IS 
'Prevents double booking: ensures no two active appointments overlap for the same employee';

COMMENT ON CONSTRAINT no_overlapping_appointments_organization ON appointments IS 
'Prevents double booking: ensures no two active appointments overlap when no specific employee is assigned';
