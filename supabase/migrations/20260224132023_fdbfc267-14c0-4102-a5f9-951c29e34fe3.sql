-- Allow users to view plans that are referenced by their own clients
CREATE POLICY "Users can view plans referenced by their clients"
ON public.plans
FOR SELECT
USING (
  id IN (SELECT plan_id FROM clients WHERE user_id = auth.uid() AND plan_id IS NOT NULL)
);

-- Same for services
CREATE POLICY "Users can view services referenced by their clients"
ON public.services
FOR SELECT
USING (
  id IN (SELECT service_id FROM clients WHERE user_id = auth.uid() AND service_id IS NOT NULL)
);