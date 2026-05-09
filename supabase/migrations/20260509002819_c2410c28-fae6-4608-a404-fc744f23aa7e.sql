
ALTER TABLE public.admin_plans
ADD COLUMN IF NOT EXISTS module_cashflow boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cash_flow_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  category text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash flow entries"
ON public.cash_flow_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash flow entries"
ON public.cash_flow_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cash flow entries"
ON public.cash_flow_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cash flow entries"
ON public.cash_flow_entries FOR DELETE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_cash_flow_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type NOT IN ('income','expense') THEN
    RAISE EXCEPTION 'type must be income or expense';
  END IF;
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cash_flow_entry_trg
BEFORE INSERT OR UPDATE ON public.cash_flow_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_cash_flow_entry();

CREATE TRIGGER update_cash_flow_entries_updated_at
BEFORE UPDATE ON public.cash_flow_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_user_date
ON public.cash_flow_entries(user_id, entry_date DESC);
