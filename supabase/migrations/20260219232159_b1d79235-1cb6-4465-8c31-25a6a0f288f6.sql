
-- Fix: restrict insert on billing_notifications_log to service role only (used by edge function)
DROP POLICY "Service role can insert notification logs" ON public.billing_notifications_log;
-- No RLS insert policy needed since the edge function uses service_role_key which bypasses RLS
