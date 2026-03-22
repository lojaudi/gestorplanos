
-- Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  description text DEFAULT '',
  payment_date timestamp with time zone,
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create own invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete own invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Updated_at trigger
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing client due_dates to invoices
INSERT INTO public.invoices (user_id, client_id, plan_id, amount, due_date, status, description)
SELECT 
  c.user_id,
  c.id,
  c.plan_id,
  COALESCE(p.price, 0),
  c.due_date,
  CASE 
    WHEN c.due_date < CURRENT_DATE THEN 'overdue'
    WHEN c.due_date = CURRENT_DATE THEN 'pending'
    ELSE 'pending'
  END,
  'Fatura migrada automaticamente'
FROM public.clients c
LEFT JOIN public.plans p ON c.plan_id = p.id;

-- Enable realtime for invoices
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
