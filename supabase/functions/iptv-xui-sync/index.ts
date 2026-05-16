// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IPTV_KEY = Deno.env.get("IPTV_DB_ENCRYPTION_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BodySchema = z.object({
  action: z.enum([
    "test-connection",
    "list-bouquets",
    "create-line",
    "update-line",
    "renew-line",
    "set-enabled",
    "delete-line",
  ]),
  server_id: z.string().uuid().optional(),
  // ad-hoc connection (used by test-connection before saving)
  connection: z
    .object({
      host: z.string().min(1),
      port: z.number().int().positive().default(7999),
      db_user: z.string().min(1),
      db_password: z.string().min(1),
      db_name: z.string().min(1),
    })
    .optional(),
  client_id: z.string().uuid().optional(),
  line: z
    .object({
      xui_user_id: z.number().int().positive().optional(),
      username: z.string().min(1).optional(),
      password: z.string().min(1).optional(),
      bouquet_ids: z.array(z.number().int()).optional(),
      max_connections: z.number().int().positive().optional(),
      exp_unix: z.number().int().optional(),
      enabled: z.boolean().optional(),
      is_trial: z.boolean().optional(),
    })
    .optional(),
});

async function connectMySQL(conn: {
  host: string;
  port: number;
  db_user: string;
  db_password: string;
  db_name: string;
}) {
  const client = await new MySQLClient().connect({
    hostname: conn.host,
    port: conn.port,
    username: conn.db_user,
    password: conn.db_password,
    db: conn.db_name,
    timeout: 8000,
    poolSize: 1,
  });
  return client;
}

async function getServerConnection(
  admin: ReturnType<typeof createClient>,
  serverId: string,
  userId: string,
) {
  const { data: server, error } = await admin
    .from("iptv_servers")
    .select("*")
    .eq("id", serverId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !server) throw new Error("Servidor não encontrado");

  const { data: pwdData, error: pwdErr } = await admin.rpc("iptv_decrypt_password", {
    _cipher: server.db_password_encrypted,
    _key: IPTV_KEY,
  });
  if (pwdErr) throw new Error("Falha ao decriptar senha do servidor");

  return {
    server,
    conn: {
      host: server.host,
      port: server.port,
      db_user: server.db_user,
      db_password: pwdData as unknown as string,
      db_name: server.db_name,
    },
  };
}

async function logSync(
  admin: ReturnType<typeof createClient>,
  payload: {
    user_id: string;
    client_id?: string | null;
    server_id?: string | null;
    action: string;
    status: "ok" | "error";
    error_message?: string | null;
    payload?: any;
  },
) {
  await admin.from("iptv_sync_logs").insert(payload);
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
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { action } = parsed.data;

    // ---------- TEST CONNECTION ----------
    if (action === "test-connection") {
      let conn = parsed.data.connection;
      let serverId: string | null = parsed.data.server_id ?? null;
      if (!conn && serverId) {
        const r = await getServerConnection(admin, serverId, userId);
        conn = r.conn;
      }
      if (!conn) return json({ error: "Conexão não informada" }, 400);

      let mysql: MySQLClient | null = null;
      try {
        mysql = await connectMySQL(conn);
        const versionRows = await mysql.query("SELECT VERSION() AS v");
        let bouquets: any[] = [];
        try {
          bouquets = await mysql.query(
            "SELECT id, bouquet_name FROM bouquets ORDER BY bouquet_name LIMIT 500",
          );
        } catch (_e) {
          // ignore — some panels use different schema
        }
        if (serverId) {
          await admin
            .from("iptv_servers")
            .update({
              last_test_at: new Date().toISOString(),
              last_test_ok: true,
              last_test_message: `OK — MySQL ${versionRows[0]?.v ?? ""}`,
            })
            .eq("id", serverId)
            .eq("user_id", userId);
        }
        return json({
          ok: true,
          version: versionRows[0]?.v ?? null,
          bouquets,
        });
      } catch (err: any) {
        const message = err?.message ?? String(err);
        if (serverId) {
          await admin
            .from("iptv_servers")
            .update({
              last_test_at: new Date().toISOString(),
              last_test_ok: false,
              last_test_message: message,
            })
            .eq("id", serverId)
            .eq("user_id", userId);
        }
        return json({ ok: false, error: message }, 200);
      } finally {
        try { await mysql?.close(); } catch (_e) { /* noop */ }
      }
    }

    // All remaining actions need a server_id
    if (!parsed.data.server_id) return json({ error: "server_id obrigatório" }, 400);
    const { server, conn } = await getServerConnection(admin, parsed.data.server_id, userId);

    let mysql: MySQLClient | null = null;
    try {
      mysql = await connectMySQL(conn);

      if (action === "list-bouquets") {
        const rows = await mysql.query(
          "SELECT id, bouquet_name FROM bouquets ORDER BY bouquet_name LIMIT 500",
        );
        return json({ ok: true, bouquets: rows });
      }

      const line = parsed.data.line ?? {};

      if (action === "create-line") {
        if (!line.username || !line.password) {
          return json({ error: "username/password obrigatórios" }, 400);
        }
        const bouquetJson = JSON.stringify(line.bouquet_ids ?? []);
        const nowSec = Math.floor(Date.now() / 1000);
        const result: any = await mysql.execute(
          `INSERT INTO users (member_id, admin_id, username, password, exp_date, max_connections,
            is_restreamer, is_trial, enabled, bouquet, created_at)
           VALUES (0, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`,
          [
            server.admin_id,
            line.username,
            line.password,
            line.exp_unix ?? null,
            line.max_connections ?? 1,
            line.is_trial ? 1 : 0,
            bouquetJson,
            nowSec,
          ],
        );
        const xuiUserId = Number(result.lastInsertId);
        await logSync(admin, {
          user_id: userId,
          client_id: parsed.data.client_id ?? null,
          server_id: server.id,
          action,
          status: "ok",
          payload: { xui_user_id: xuiUserId, username: line.username },
        });
        return json({ ok: true, xui_user_id: xuiUserId });
      }

      if (action === "update-line" || action === "renew-line") {
        if (!line.xui_user_id) return json({ error: "xui_user_id obrigatório" }, 400);
        const sets: string[] = [];
        const args: any[] = [];
        if (line.exp_unix !== undefined) { sets.push("exp_date = ?"); args.push(line.exp_unix); }
        if (action === "update-line") {
          if (line.bouquet_ids) { sets.push("bouquet = ?"); args.push(JSON.stringify(line.bouquet_ids)); }
          if (line.max_connections !== undefined) { sets.push("max_connections = ?"); args.push(line.max_connections); }
          if (line.password) { sets.push("password = ?"); args.push(line.password); }
          if (line.enabled !== undefined) { sets.push("enabled = ?"); args.push(line.enabled ? 1 : 0); }
        }
        if (!sets.length) return json({ error: "Nada para atualizar" }, 400);
        args.push(line.xui_user_id);
        await mysql.execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args);
        await logSync(admin, {
          user_id: userId,
          client_id: parsed.data.client_id ?? null,
          server_id: server.id,
          action,
          status: "ok",
          payload: { xui_user_id: line.xui_user_id, fields: sets },
        });
        return json({ ok: true });
      }

      if (action === "set-enabled") {
        if (!line.xui_user_id || line.enabled === undefined) {
          return json({ error: "xui_user_id e enabled obrigatórios" }, 400);
        }
        await mysql.execute("UPDATE users SET enabled = ? WHERE id = ?", [
          line.enabled ? 1 : 0,
          line.xui_user_id,
        ]);
        await logSync(admin, {
          user_id: userId,
          client_id: parsed.data.client_id ?? null,
          server_id: server.id,
          action,
          status: "ok",
          payload: { xui_user_id: line.xui_user_id, enabled: line.enabled },
        });
        return json({ ok: true });
      }

      if (action === "delete-line") {
        if (!line.xui_user_id) return json({ error: "xui_user_id obrigatório" }, 400);
        await mysql.execute("DELETE FROM users WHERE id = ?", [line.xui_user_id]);
        await logSync(admin, {
          user_id: userId,
          client_id: parsed.data.client_id ?? null,
          server_id: server.id,
          action,
          status: "ok",
          payload: { xui_user_id: line.xui_user_id },
        });
        return json({ ok: true });
      }

      return json({ error: "Ação desconhecida" }, 400);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await logSync(admin, {
        user_id: userId,
        client_id: parsed.data.client_id ?? null,
        server_id: parsed.data.server_id ?? null,
        action,
        status: "error",
        error_message: message,
      });
      return json({ ok: false, error: message }, 200);
    } finally {
      try { await mysql?.close(); } catch (_e) { /* noop */ }
    }
  } catch (err: any) {
    return json({ error: err?.message ?? "Erro interno" }, 500);
  }
});
