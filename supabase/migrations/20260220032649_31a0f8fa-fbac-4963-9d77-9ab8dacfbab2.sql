-- Fix UPDATE policy for plans to allow admin updates
DROP POLICY IF EXISTS "Users can update own plans" ON public.plans;
CREATE POLICY "Users can update own plans or admin"
ON public.plans
FOR UPDATE
USING ((auth.uid() = user_id) OR is_admin());

-- Fix DELETE policy for plans to allow admin deletes
DROP POLICY IF EXISTS "Users can delete own plans" ON public.plans;
CREATE POLICY "Users can delete own plans or admin"
ON public.plans
FOR DELETE
USING ((auth.uid() = user_id) OR is_admin());

-- Fix UPDATE policy for services to allow admin updates
DROP POLICY IF EXISTS "Users can update own services" ON public.services;
CREATE POLICY "Users can update own services or admin"
ON public.services
FOR UPDATE
USING ((auth.uid() = user_id) OR is_admin());

-- Fix DELETE policy for services to allow admin deletes
DROP POLICY IF EXISTS "Users can delete own services" ON public.services;
CREATE POLICY "Users can delete own services or admin"
ON public.services
FOR DELETE
USING ((auth.uid() = user_id) OR is_admin());

-- Fix UPDATE policy for clients to allow admin updates
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients or admin"
ON public.clients
FOR UPDATE
USING ((auth.uid() = user_id) OR is_admin());

-- Fix DELETE policy for clients to allow admin deletes  
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
CREATE POLICY "Users can delete own clients or admin"
ON public.clients
FOR DELETE
USING ((auth.uid() = user_id) OR is_admin());