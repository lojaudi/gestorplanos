import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IPTV_KEY = Deno.env.get("IPTV_DB_ENCRYPTION_KEY")!;

const Body = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().positive().default(7999),
  db_user: z.string().min(1).max(100),
  db_password: z.string().min(1).nullable().optional(),
  db_name: z.string().min(1).max(100),
  admin_id: z.number().int().positive().default(1),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: c, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !c?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = c.claims.sub as string;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let encrypted: string | null = null;
    if (b.db_password) {
      const { data: enc, error: encErr } = await admin.rpc("iptv_encrypt_password", {
        _plain: b.db_password,
        _key: IPTV_KEY,
      });
      if (encErr) return json({ error: "Falha ao criptografar senha" }, 500);
      encrypted = enc as unknown as string;
    }

    if (b.id) {
      const update: Record<string, unknown> = {
        name: b.name,
        host: b.host,
        port: b.port,
        db_user: b.db_user,
        db_name: b.db_name,
        admin_id: b.admin_id,
        updated_at: new Date().toISOString(),
      };
      if (encrypted) update.db_password_encrypted = encrypted;
      const { error } = await admin
        .from("iptv_servers")
        .update(update)
        .eq("id", b.id)
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id: b.id });
    } else {
      if (!encrypted) return json({ error: "Senha obrigatória ao criar" }, 400);
      const { data, error } = await admin
        .from("iptv_servers")
        .insert({
          user_id: userId,
          name: b.name,
          host: b.host,
          port: b.port,
          db_user: b.db_user,
          db_name: b.db_name,
          admin_id: b.admin_id,
          db_password_encrypted: encrypted,
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id: data.id });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
