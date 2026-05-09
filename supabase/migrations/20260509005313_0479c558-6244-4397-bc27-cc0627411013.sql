CREATE TABLE public.cash_flow_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, name)
);

ALTER TABLE public.cash_flow_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash flow categories"
ON public.cash_flow_categories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash flow categories"
ON public.cash_flow_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cash flow categories"
ON public.cash_flow_categories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cash flow categories"
ON public.cash_flow_categories FOR DELETE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_cash_flow_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type NOT IN ('income','expense') THEN
    RAISE EXCEPTION 'type must be income or expense';
  END IF;
  IF length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'name is required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cash_flow_category_trigger
BEFORE INSERT OR UPDATE ON public.cash_flow_categories
FOR EACH ROW EXECUTE FUNCTION public.validate_cash_flow_category();

CREATE TRIGGER update_cash_flow_categories_updated_at
BEFORE UPDATE ON public.cash_flow_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();