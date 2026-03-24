ALTER TABLE IF EXISTS public.companies 
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS plan_name text DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone;

-- Add reminder tracking and blocking to appointments
ALTER TABLE IF EXISTS public.appointments 
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
