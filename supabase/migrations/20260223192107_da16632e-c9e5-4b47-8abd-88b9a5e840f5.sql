ALTER TABLE public.message_templates DROP CONSTRAINT message_templates_type_check;

ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_type_check CHECK (type = ANY (ARRAY['vencendo_hoje'::text, 'vencido'::text, 'vencendo_amanha'::text, 'confirmacao_pagamento'::text, 'cobranca_manual'::text, 'proximos_3_dias'::text, 'due_today'::text, 'overdue'::text, 'due_soon'::text]));