import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAuthUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getUserConfig(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

async function evolutionFetch(
  apiUrl: string,
  apiKey: string,
  path: string,
  method = "GET",
  body?: unknown
) {
  const url = `${apiUrl.replace(/\/$/, "")}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Evolution API [${res.status}]: ${JSON.stringify(data)}`
    );
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return errorResponse("Não autenticado", 401);

    const { action, ...params } = await req.json();

    // Actions that don't require existing config
    if (action === "save-config") {
      const { api_url, api_key, instance_name } = params;
      if (!api_url || !api_key || !instance_name) {
        return errorResponse("URL da API, chave e nome da instância são obrigatórios");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const { data: existing } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("whatsapp_config")
          .update({ api_url, api_key, instance_name, is_connected: false })
          .eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_config").insert({
          user_id: user.id,
          api_url,
          api_key,
          instance_name,
        });
      }

      return jsonResponse({ success: true });
    }

    // All other actions require existing config
    const config = await getUserConfig(user.id);
    if (!config) return errorResponse("Configuração WhatsApp não encontrada");

    const { api_url, api_key, instance_name } = config;

    if (action === "create-instance") {
      const data = await evolutionFetch(api_url, api_key, "/instance/create", "POST", {
        instanceName: instance_name,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
      return jsonResponse(data);
    }

    if (action === "get-qrcode") {
      const data = await evolutionFetch(
        api_url,
        api_key,
        `/instance/connect/${instance_name}`
      );
      return jsonResponse(data);
    }

    if (action === "connection-status") {
      const data = await evolutionFetch(
        api_url,
        api_key,
        `/instance/connectionState/${instance_name}`
      );

      const connected = data?.instance?.state === "open";

      // Update DB status
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase
        .from("whatsapp_config")
        .update({ is_connected: connected })
        .eq("id", config.id);

      return jsonResponse({ ...data, is_connected: connected });
    }

    if (action === "logout-instance") {
      const data = await evolutionFetch(
        api_url,
        api_key,
        `/instance/logout/${instance_name}`,
        "DELETE"
      );

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase
        .from("whatsapp_config")
        .update({ is_connected: false })
        .eq("id", config.id);

      return jsonResponse(data);
    }

    if (action === "delete-instance") {
      const data = await evolutionFetch(
        api_url,
        api_key,
        `/instance/delete/${instance_name}`,
        "DELETE"
      );

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase
        .from("whatsapp_config")
        .update({ is_connected: false })
        .eq("id", config.id);

      return jsonResponse(data);
    }

    return errorResponse("Ação desconhecida: " + action);
  } catch (err) {
    console.error("Evolution API error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return errorResponse(message, 500);
  }
});
