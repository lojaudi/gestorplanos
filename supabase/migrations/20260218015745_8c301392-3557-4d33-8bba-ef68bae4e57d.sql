
ALTER TABLE public.platform_settings
ADD COLUMN whatsapp_verification_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN email_verification_enabled boolean NOT NULL DEFAULT false;
