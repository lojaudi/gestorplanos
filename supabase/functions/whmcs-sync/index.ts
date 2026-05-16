import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface WhmcsConfig {
  api_url: string;
  api_identifier: string;
  api_secret: string;
}

async function callWhmcs(cfg: WhmcsConfig, action: string, params: Record<string, string | number> = {}) {
  const url = cfg.api_url.replace(/\/+$/, "") + "/includes/api.php";
  const body = new URLSearchParams({
    identifier: cfg.api_identifier,
    secret: cfg.api_secret,
    action,
    responsetype: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do WHMCS: ${text.slice(0, 200)}`);
  }
  if (data.result === "error") {
    throw new Error(data.message || "Erro WHMCS");
  }
  return data;
}

function formatPhoneBR(phone: string, countryCode?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  // If already has country code
  if (digits.length > 11) return digits;
  // Brazil default
  if (!countryCode || countryCode.toUpperCase() === "BR") {
    return "55" + digits;
  }
  // Other countries: prepend country dial code if known
  const dialCodes: Record<string, string> = {
    US: "1", GB: "44", PT: "351", ES: "34", FR: "33", DE: "49",
    IT: "39", AR: "54", CL: "56", CO: "57", MX: "52", PY: "595",
    UY: "598", PE: "51", JP: "81", CN: "86",
  };
  const dc = dialCodes[countryCode.toUpperCase()];
  return dc ? dc + digits : digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    // Load WHMCS config (service role bypasses RLS)
    const { data: cfgRow, error: cfgErr } = await admin
      .from("whmcs_global_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (cfgErr) throw cfgErr;

    const body = await req.json();
    const action = body.action as string;

    // For test-connection action, accept inline credentials (admin only)
    let cfg: WhmcsConfig | null = cfgRow
      ? { api_url: cfgRow.api_url, api_identifier: cfgRow.api_identifier, api_secret: cfgRow.api_secret }
      : null;

    if (action === "test-connection") {
      // Check admin role
      const { data: roleData } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) return json(403, { error: "Apenas admin" });

      const test: WhmcsConfig = body.config || cfg;
      if (!test?.api_url || !test?.api_identifier || !test?.api_secret) {
        return json(400, { error: "Credenciais incompletas" });
      }
      const data = await callWhmcs(test, "WhmcsDetails");
      return json(200, { ok: true, version: data?.whmcs?.version || "?", data });
    }

    if (!cfg || !cfg.api_url) return json(400, { error: "Integração WHMCS não configurada" });

    if (action === "list-clients") {
      const limitstart = Number(body.limitstart || 0);
      const limitnum = Math.min(Number(body.limitnum || 25), 100);
      const search = (body.search || "").toString();
      const status = (body.status || "").toString();
      const params: Record<string, string | number> = { limitstart, limitnum };
      if (search) params.search = search;
      if (status && status !== "all") params.status = status;
      const data = await callWhmcs(cfg, "GetClients", params);
      const clients = data?.clients?.client || [];
      return json(200, {
        clients: Array.isArray(clients) ? clients : [clients],
        totalresults: Number(data?.totalresults || 0),
        startnumber: Number(data?.startnumber || 0),
        numreturned: Number(data?.numreturned || 0),
      });
    }

    if (action === "import-clients") {
      const ids: number[] = (body.client_ids || []).map((n: any) => Number(n)).filter(Boolean);
      if (!ids.length) return json(400, { error: "Nenhum cliente selecionado" });

      const imported: any[] = [];
      const skipped: any[] = [];
      const errors: any[] = [];

      for (const cid of ids) {
        try {
          const details = await callWhmcs(cfg, "GetClientsDetails", { clientid: cid });
          const c = details?.client || details;
          const name = `${c.firstname || ""} ${c.lastname || ""}`.trim() || c.companyname || `Cliente WHMCS ${cid}`;
          const phone = formatPhoneBR(c.phonenumber || "", c.country);
          if (!phone) {
            skipped.push({ whmcs_id: cid, name, reason: "Sem telefone" });
            continue;
          }
          // Dedup by phone for this user
          const { data: existing } = await admin
            .from("clients")
            .select("id")
            .eq("user_id", userId)
            .eq("phone", phone)
            .limit(1)
            .maybeSingle();
          if (existing) {
            skipped.push({ whmcs_id: cid, name, reason: "Já existe (telefone)" });
            continue;
          }
          const { error: insErr } = await admin.from("clients").insert({
            user_id: userId,
            name,
            phone,
            username: c.email || null,
          });
          if (insErr) {
            errors.push({ whmcs_id: cid, name, error: insErr.message });
          } else {
            imported.push({ whmcs_id: cid, name, phone });
          }
        } catch (e: any) {
          errors.push({ whmcs_id: cid, error: e.message || String(e) });
        }
      }

      return json(200, { imported, skipped, errors });
    }

    return json(400, { error: "Ação inválida" });
  } catch (e: any) {
    console.error("whmcs-sync error", e);
    return json(500, { error: e.message || String(e) });
  }
});
