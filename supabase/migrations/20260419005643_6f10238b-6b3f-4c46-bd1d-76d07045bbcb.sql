-- Fix plans SELECT policy: remove admin bypass that leaked all users' plans
DROP POLICY IF EXISTS "Users can view own plans" ON public.plans;
CREATE POLICY "Users can view own plans"
ON public.plans
FOR SELECT
USING (auth.uid() = user_id);

-- Fix services SELECT policy: remove admin bypass that leaked all users' services
DROP POLICY IF EXISTS "Users can view own services" ON public.services;
CREATE POLICY "Users can view own services"
ON public.services
FOR SELECT
USING (auth.uid() = user_id);