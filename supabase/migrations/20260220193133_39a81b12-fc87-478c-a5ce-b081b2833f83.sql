
-- Create support materials table for admin-managed content
CREATE TABLE public.support_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_materials ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view published materials
CREATE POLICY "Anyone authenticated can view published support materials"
ON public.support_materials
FOR SELECT
USING ((is_published = true) OR is_admin());

-- Only admins can insert
CREATE POLICY "Only admins can insert support materials"
ON public.support_materials
FOR INSERT
WITH CHECK (is_admin());

-- Only admins can update
CREATE POLICY "Only admins can update support materials"
ON public.support_materials
FOR UPDATE
USING (is_admin());

-- Only admins can delete
CREATE POLICY "Only admins can delete support materials"
ON public.support_materials
FOR DELETE
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_support_materials_updated_at
BEFORE UPDATE ON public.support_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
