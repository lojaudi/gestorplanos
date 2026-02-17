
-- Add phone column to profiles
ALTER TABLE public.profiles ADD COLUMN phone text;

-- Create whatsapp verifications table
CREATE TABLE public.whatsapp_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  phone text NOT NULL,
  full_name text NOT NULL,
  code text NOT NULL,
  password_hash text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_verifications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts/selects for verification flow (edge function uses service role)
-- No public policies needed since edge function uses service role key

-- Auto-cleanup expired verifications
CREATE INDEX idx_whatsapp_verifications_expires ON public.whatsapp_verifications (expires_at);
CREATE INDEX idx_whatsapp_verifications_email ON public.whatsapp_verifications (email);
