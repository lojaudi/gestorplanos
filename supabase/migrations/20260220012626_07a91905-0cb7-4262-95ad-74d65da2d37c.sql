
-- Allow admins to update any billing automation config
DROP POLICY IF EXISTS "Users can update own automation config" ON public.billing_automation_config;
CREATE POLICY "Users can update own automation config or admin"
  ON public.billing_automation_config
  FOR UPDATE
  USING ((auth.uid() = user_id) OR is_admin());
