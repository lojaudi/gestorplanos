
ALTER TABLE public.cash_flow_entries
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.cash_flow_entries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_recurring ON public.cash_flow_entries(user_id, is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_recurrence_parent ON public.cash_flow_entries(recurrence_parent_id);
