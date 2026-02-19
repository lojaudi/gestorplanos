
-- Table to store automation config per user
CREATE TABLE public.billing_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  notify_before_due BOOLEAN NOT NULL DEFAULT true,
  notify_on_due BOOLEAN NOT NULL DEFAULT true,
  notify_after_due BOOLEAN NOT NULL DEFAULT true,
  send_hour INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.billing_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation config" ON public.billing_automation_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own automation config" ON public.billing_automation_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automation config" ON public.billing_automation_config FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_billing_automation_config_updated_at
  BEFORE UPDATE ON public.billing_automation_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table to track sent notifications (avoid duplicates)
CREATE TABLE public.billing_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'before_due', 'on_due', 'after_due'
  due_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  message_content TEXT,
  UNIQUE(user_id, client_id, notification_type, due_date)
);

ALTER TABLE public.billing_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs" ON public.billing_notifications_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert notification logs" ON public.billing_notifications_log FOR INSERT WITH CHECK (true);
