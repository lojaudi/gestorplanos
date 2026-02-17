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

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceKey);
}

async function getAuthUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function checkIsAdmin(userId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function getGlobalConfig() {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("whatsapp_global_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  return data;
}

async function getUserConfig(userId: string) {
  const supabase = getServiceClient();
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

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    // === PUBLIC ACTIONS (no auth required) ===
    if (action === "send-verification-code") {
      const { phone, email, full_name } = params;
      if (!phone || !email || !full_name) {
        return errorResponse("Telefone, email e nome são obrigatórios");
      }

      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 12 || cleanPhone.length > 13) {
        return errorResponse("Número de WhatsApp inválido. Use o formato: 55DDD + número");
      }

      const globalConfig = await getGlobalConfig();
      if (!globalConfig) {
        return errorResponse("Configuração global do WhatsApp não encontrada. Contate o administrador.");
      }

      // Check if email already exists in auth
      const supabase = getServiceClient();
      
      // Delete expired verifications for this email
      await supabase
        .from("whatsapp_verifications")
        .delete()
        .lt("expires_at", new Date().toISOString());

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      // Store verification
      await supabase.from("whatsapp_verifications").insert({
        email,
        phone: cleanPhone,
        full_name,
        code,
        password_hash: params.password || "",
        expires_at: expiresAt,
      });

      // Send code via WhatsApp using global config instance
      // We need an admin instance to send. Use global config.
      // Find any admin's whatsapp_config or use a system instance
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      let instanceName = "system";
      if (adminRole) {
        const adminConfig = await getUserConfig(adminRole.user_id);
        if (adminConfig && adminConfig.is_connected) {
          instanceName = adminConfig.instance_name;
        }
      }

      const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const message = `🔐 Seu código de verificação é: *${code}*\n\nEsse código expira em 10 minutos.\nNão compartilhe com ninguém.`;

      try {
        await evolutionFetch(
          globalConfig.api_url,
          globalConfig.api_key,
          `/message/sendText/${instanceName}`,
          "POST",
          { number: formattedPhone, text: message }
        );
      } catch (sendErr) {
        console.error("Erro ao enviar código:", sendErr);
        return errorResponse("Erro ao enviar código de verificação via WhatsApp. Verifique o número e tente novamente.");
      }

      return jsonResponse({ success: true, message: "Código enviado via WhatsApp" });
    }

    if (action === "verify-code") {
      const { email, code } = params;
      if (!email || !code) {
        return errorResponse("Email e código são obrigatórios");
      }

      const supabase = getServiceClient();
      const { data: verification } = await supabase
        .from("whatsapp_verifications")
        .select("*")
        .eq("email", email)
        .eq("code", code.toUpperCase())
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!verification) {
        return errorResponse("Código inválido ou expirado");
      }

      // Mark as verified
      await supabase
        .from("whatsapp_verifications")
        .update({ verified: true })
        .eq("id", verification.id);

      return jsonResponse({ 
        success: true, 
        verified: true,
        phone: verification.phone,
        full_name: verification.full_name,
      });
    }

    // === AUTHENTICATED ACTIONS ===
    const user = await getAuthUser(req);
    if (!user) return errorResponse("Não autenticado", 401);

    // === ADMIN ACTIONS: save/get global config ===
    if (action === "save-global-config") {
      const isAdmin = await checkIsAdmin(user.id);
      if (!isAdmin) return errorResponse("Acesso negado", 403);

      const { api_url, api_key } = params;
      if (!api_url || !api_key) {
        return errorResponse("URL da API e chave são obrigatórios");
      }

      const supabase = getServiceClient();
      const existing = await getGlobalConfig();

      if (existing) {
        await supabase
          .from("whatsapp_global_config")
          .update({ api_url, api_key })
          .eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_global_config").insert({ api_url, api_key });
      }

      return jsonResponse({ success: true });
    }

    if (action === "get-global-config") {
      const isAdmin = await checkIsAdmin(user.id);
      if (!isAdmin) return errorResponse("Acesso negado", 403);

      const config = await getGlobalConfig();
      return jsonResponse({ config });
    }

    // === USER ACTIONS: save instance name ===
    if (action === "save-config") {
      const { instance_name } = params;
      if (!instance_name) {
        return errorResponse("Nome da instância é obrigatório");
      }

      const globalConfig = await getGlobalConfig();
      if (!globalConfig) {
        return errorResponse("Configuração global do WhatsApp não encontrada. Contate o administrador.");
      }

      const supabase = getServiceClient();
      const { data: existing } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("whatsapp_config")
          .update({ instance_name, api_url: globalConfig.api_url, api_key: globalConfig.api_key, is_connected: false })
          .eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_config").insert({
          user_id: user.id,
          api_url: globalConfig.api_url,
          api_key: globalConfig.api_key,
          instance_name,
        });
      }

      return jsonResponse({ success: true });
    }

    // === USER ACTION: connect-instance (save + create + return QR in one step) ===
    if (action === "connect-instance") {
      const { instance_name } = params;
      if (!instance_name) {
        return errorResponse("Nome da instância é obrigatório");
      }

      const globalConfig = await getGlobalConfig();
      if (!globalConfig) {
        return errorResponse("Configuração global do WhatsApp não encontrada. Contate o administrador.");
      }

      const supabase = getServiceClient();
      const { data: existing } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("whatsapp_config")
          .update({ instance_name, api_url: globalConfig.api_url, api_key: globalConfig.api_key, is_connected: false })
          .eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_config").insert({
          user_id: user.id,
          api_url: globalConfig.api_url,
          api_key: globalConfig.api_key,
          instance_name,
        });
      }

      // Try to connect existing instance first, create only if not found
      const { api_url, api_key } = globalConfig;
      let resultData;
      try {
        resultData = await evolutionFetch(api_url, api_key, `/instance/connect/${instance_name}`);
      } catch (_e) {
        try {
          resultData = await evolutionFetch(api_url, api_key, "/instance/create", "POST", {
            instanceName: instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          });
        } catch (createErr) {
          const msg = createErr instanceof Error ? createErr.message : String(createErr);
          if (msg.includes("already in use")) {
            resultData = await evolutionFetch(api_url, api_key, `/instance/connect/${instance_name}`);
          } else {
            throw createErr;
          }
        }
      }

      return jsonResponse(resultData);
    }

    // All other actions require existing user config + global config
    const globalConfig = await getGlobalConfig();
    if (!globalConfig) {
      return errorResponse("Configuração global do WhatsApp não encontrada. Contate o administrador.");
    }

    const config = await getUserConfig(user.id);
    if (!config) return errorResponse("Configuração WhatsApp não encontrada. Salve o nome da instância primeiro.");

    const { api_url, api_key } = globalConfig;
    const { instance_name } = config;

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

      const supabase = getServiceClient();
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

      const supabase = getServiceClient();
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

      const supabase = getServiceClient();
      await supabase
        .from("whatsapp_config")
        .update({ is_connected: false })
        .eq("id", config.id);

      return jsonResponse(data);
    }

    if (action === "send-message") {
      const { phone, message, client_id, template_type } = params;
      if (!phone || !message) {
        return errorResponse("Telefone e mensagem são obrigatórios");
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

      let status = "sent";
      let apiResponse = "";

      try {
        const result = await evolutionFetch(
          api_url,
          api_key,
          `/message/sendText/${instance_name}`,
          "POST",
          { number: formattedPhone, text: message }
        );
        apiResponse = JSON.stringify(result);
      } catch (sendErr) {
        status = "error";
        apiResponse = sendErr instanceof Error ? sendErr.message : String(sendErr);
      }

      const supabase = getServiceClient();
      await supabase.from("message_logs").insert({
        user_id: user.id,
        client_id: client_id || null,
        message_content: message,
        status,
        template_type: template_type || "manual",
        api_response: apiResponse,
      });

      return jsonResponse({ success: status === "sent", status, api_response: apiResponse });
    }

    if (action === "send-bulk") {
      const { messages } = params;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return errorResponse("Lista de mensagens é obrigatória");
      }

      const supabase = getServiceClient();
      const results = [];

      for (const msg of messages) {
        const cleanPhone = msg.phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        let status = "sent";
        let apiResponse = "";

        try {
          const result = await evolutionFetch(
            api_url,
            api_key,
            `/message/sendText/${instance_name}`,
            "POST",
            { number: formattedPhone, text: msg.message }
          );
          apiResponse = JSON.stringify(result);
        } catch (sendErr) {
          status = "error";
          apiResponse = sendErr instanceof Error ? sendErr.message : String(sendErr);
        }

        await supabase.from("message_logs").insert({
          user_id: user.id,
          client_id: msg.client_id || null,
          message_content: msg.message,
          status,
          template_type: msg.template_type || "cobranca",
          api_response: apiResponse,
        });

        results.push({ client_id: msg.client_id, phone: msg.phone, status });
        await new Promise((r) => setTimeout(r, 1500));
      }

      return jsonResponse({ success: true, results });
    }

    return errorResponse("Ação desconhecida: " + action);
  } catch (err) {
    console.error("Evolution API error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return errorResponse(message, 500);
  }
});
