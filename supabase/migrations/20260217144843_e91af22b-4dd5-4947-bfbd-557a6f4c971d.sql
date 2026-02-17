
-- Table for admin-managed subscription plans for users
CREATE TABLE public.admin_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  max_clients INTEGER NOT NULL DEFAULT 50,
  module_campaigns BOOLEAN NOT NULL DEFAULT false,
  module_games BOOLEAN NOT NULL DEFAULT false,
  module_banners BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_plans ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view active plans
CREATE POLICY "Anyone authenticated can view active admin plans"
ON public.admin_plans FOR SELECT
USING (is_active = true OR is_admin());

-- Only admins can insert
CREATE POLICY "Only admins can insert admin plans"
ON public.admin_plans FOR INSERT
WITH CHECK (is_admin());

-- Only admins can update
CREATE POLICY "Only admins can update admin plans"
ON public.admin_plans FOR UPDATE
USING (is_admin());

-- Only admins can delete
CREATE POLICY "Only admins can delete admin plans"
ON public.admin_plans FOR DELETE
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_admin_plans_updated_at
BEFORE UPDATE ON public.admin_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
