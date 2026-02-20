
-- Allow admins to view all billing automation configs
DROP POLICY IF EXISTS "Users can view own automation config" ON public.billing_automation_config;
CREATE POLICY "Users can view own automation config or admin"
  ON public.billing_automation_config
  FOR SELECT
  USING ((auth.uid() = user_id) OR is_admin());
