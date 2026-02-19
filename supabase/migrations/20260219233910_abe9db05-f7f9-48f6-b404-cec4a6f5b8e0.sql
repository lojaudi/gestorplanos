
-- Add separate hour columns for each notification type
ALTER TABLE public.billing_automation_config 
  ADD COLUMN IF NOT EXISTS send_hour_before_due integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS send_hour_on_due integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS send_hour_after_due integer NOT NULL DEFAULT 15;

-- Migrate existing send_hour value to all three new columns
UPDATE public.billing_automation_config 
SET send_hour_before_due = send_hour,
    send_hour_on_due = send_hour,
    send_hour_after_due = send_hour;
