
-- IPTV XUI.One integration tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Servers (per user)
CREATE TABLE public.iptv_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 7999,
  db_user text NOT NULL,
  db_password_encrypted text NOT NULL,
  db_name text NOT NULL DEFAULT 'xui_iptvpro',
  admin_id integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own iptv servers" ON public.iptv_servers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own iptv servers" ON public.iptv_servers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own iptv servers" ON public.iptv_servers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own iptv servers" ON public.iptv_servers
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_iptv_servers_updated_at
  BEFORE UPDATE ON public.iptv_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Client line bindings (one per client)
CREATE TABLE public.iptv_client_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL UNIQUE,
  server_id uuid NOT NULL REFERENCES public.iptv_servers(id) ON DELETE RESTRICT,
  xui_user_id bigint,
  xui_username text NOT NULL,
  xui_password text NOT NULL,
  bouquet_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_connections integer NOT NULL DEFAULT 1,
  is_trial boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  exp_date timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_client_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own iptv lines" ON public.iptv_client_lines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own iptv lines" ON public.iptv_client_lines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own iptv lines" ON public.iptv_client_lines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own iptv lines" ON public.iptv_client_lines
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_iptv_client_lines_updated_at
  BEFORE UPDATE ON public.iptv_client_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_iptv_client_lines_user ON public.iptv_client_lines(user_id);
CREATE INDEX idx_iptv_client_lines_server ON public.iptv_client_lines(server_id);

-- Sync logs (audit)
CREATE TABLE public.iptv_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  server_id uuid,
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own iptv sync logs" ON public.iptv_sync_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_iptv_sync_logs_user_created ON public.iptv_sync_logs(user_id, created_at DESC);
CREATE INDEX idx_iptv_sync_logs_client ON public.iptv_sync_logs(client_id);

-- Encryption helpers (use IPTV_DB_ENCRYPTION_KEY env var via vault or secret read in edge function)
-- We store encrypted password as text using pgp_sym_encrypt; key passed by edge function via RPC.

CREATE OR REPLACE FUNCTION public.iptv_encrypt_password(_plain text, _key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(pgp_sym_encrypt(_plain, _key), 'base64')
$$;

CREATE OR REPLACE FUNCTION public.iptv_decrypt_password(_cipher text, _key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT pgp_sym_decrypt(decode(_cipher, 'base64'), _key)
$$;

REVOKE ALL ON FUNCTION public.iptv_encrypt_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.iptv_decrypt_password(text, text) FROM PUBLIC, anon, authenticated;
