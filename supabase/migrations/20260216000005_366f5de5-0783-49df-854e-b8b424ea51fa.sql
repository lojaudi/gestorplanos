-- Allow admins to update any profile (for activate/deactivate)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin());
