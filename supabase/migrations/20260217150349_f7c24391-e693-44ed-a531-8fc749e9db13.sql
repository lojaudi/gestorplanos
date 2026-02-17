
-- Add admin_plan_id column to profiles to link users to admin plans
ALTER TABLE public.profiles
ADD COLUMN admin_plan_id UUID REFERENCES public.admin_plans(id) ON DELETE SET NULL DEFAULT NULL;
