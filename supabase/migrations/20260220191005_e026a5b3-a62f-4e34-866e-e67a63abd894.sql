
ALTER TABLE public.admin_plans
ADD COLUMN duration_months integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.admin_plans.duration_months IS 'Plan duration: 1=monthly, 3=quarterly, 6=semiannual, 12=annual';
