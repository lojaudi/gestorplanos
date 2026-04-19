-- Remove admin bypass from SELECT policies so each user (including admin) only sees their own data

-- clients
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
CREATE POLICY "Users can view own clients"
ON public.clients FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own clients or admin" ON public.clients;
CREATE POLICY "Users can update own clients"
ON public.clients FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own clients or admin" ON public.clients;
CREATE POLICY "Users can delete own clients"
ON public.clients FOR DELETE
USING (auth.uid() = user_id);

-- invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices"
ON public.invoices FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
CREATE POLICY "Users can delete own invoices"
ON public.invoices FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- message_templates
DROP POLICY IF EXISTS "Users can view own templates" ON public.message_templates;
CREATE POLICY "Users can view own templates"
ON public.message_templates FOR SELECT
USING (auth.uid() = user_id);

-- message_logs
DROP POLICY IF EXISTS "Users can view own logs" ON public.message_logs;
CREATE POLICY "Users can view own logs"
ON public.message_logs FOR SELECT
USING (auth.uid() = user_id);

-- whatsapp_config
DROP POLICY IF EXISTS "Users can view own config" ON public.whatsapp_config;
CREATE POLICY "Users can view own config"
ON public.whatsapp_config FOR SELECT
USING (auth.uid() = user_id);

-- billing_automation_config
DROP POLICY IF EXISTS "Users can view own automation config or admin" ON public.billing_automation_config;
CREATE POLICY "Users can view own automation config"
ON public.billing_automation_config FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own automation config or admin" ON public.billing_automation_config;
CREATE POLICY "Users can update own automation config"
ON public.billing_automation_config FOR UPDATE
USING (auth.uid() = user_id);

-- football_user_config
DROP POLICY IF EXISTS "Users can view own football config" ON public.football_user_config;
CREATE POLICY "Users can view own football config"
ON public.football_user_config FOR SELECT
USING (auth.uid() = user_id);

-- Note: profiles and user_roles keep admin bypass (needed for AdminUsers panel).
-- Note: admin_plans keep is_admin() (needed for managing plans in admin panel).
