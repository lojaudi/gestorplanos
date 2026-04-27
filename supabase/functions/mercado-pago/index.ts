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
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getAuthUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    // Public action - get payment link details (no auth required)
    if (action === "get-payment") {
      const { payment_id } = params;
      if (!payment_id) return errorResponse("ID do pagamento é obrigatório");

      const supabase = getServiceClient();
      const { data: payment, error } = await supabase
        .from("payment_links")
        .select("id, amount, description, status, qr_code_base64, pix_copy_paste, expires_at, client_id")
        .eq("id", payment_id)
        .maybeSingle();

      if (error || !payment) return errorResponse("Link de pagamento não encontrado", 404);

      // Get client name
      let clientName = "";
      if (payment.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", payment.client_id)
          .maybeSingle();
        clientName = client?.name || "";
      }

      return jsonResponse({
        ...payment,
        client_name: clientName,
      });
    }

    // Check if admin has gateway configured (any authenticated user can check)
    if (action === "check-admin-gateway") {
      const { admin_user_id } = params;
      if (!admin_user_id) return errorResponse("admin_user_id é obrigatório");

      const svc = getServiceClient();
      const { data: config } = await svc
        .from("payment_gateway_config")
        .select("is_enabled")
        .eq("user_id", admin_user_id)
        .eq("provider", "mercado_pago")
        .eq("is_enabled", true)
        .maybeSingle();

      return jsonResponse({ has_gateway: !!config });
    }

    // All other actions require authentication
    const user = await getAuthUser(req);
    if (!user) return errorResponse("Não autenticado", 401);

    const supabase = getServiceClient();

    if (action === "save-config") {
      const { access_token, is_enabled, pix_key } = params;

      const { data: existing } = await supabase
        .from("payment_gateway_config")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "mercado_pago")
        .maybeSingle();

      const updateData: Record<string, unknown> = { is_enabled: is_enabled ?? false };
      if (access_token) updateData.access_token = access_token;
      if (pix_key !== undefined) updateData.pix_key = pix_key;

      if (existing) {
        await supabase
          .from("payment_gateway_config")
          .update(updateData)
          .eq("id", existing.id);
      } else {
        if (!access_token && !pix_key) return errorResponse("Informe o Access Token ou a Chave Pix");
        await supabase.from("payment_gateway_config").insert({
          user_id: user.id,
          provider: "mercado_pago",
          access_token: access_token || "",
          is_enabled: is_enabled ?? false,
          pix_key: pix_key || "",
        });
      }

      return jsonResponse({ success: true });
    }

    if (action === "get-config") {
      const { data } = await supabase
        .from("payment_gateway_config")
        .select("id, provider, is_enabled, pix_key, access_token, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("provider", "mercado_pago")
        .maybeSingle();

      return jsonResponse({ config: data });
    }

    if (action === "create-payment") {
      const { client_id, amount, description } = params;
      if (!client_id || !amount) return errorResponse("Cliente e valor são obrigatórios");

      // Get user's MP config
      const { data: config } = await supabase
        .from("payment_gateway_config")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "mercado_pago")
        .maybeSingle();

      if (!config || !config.is_enabled) {
        return errorResponse("Gateway de pagamento não configurada ou desativada");
      }

      // Get client info
      const { data: client } = await supabase
        .from("clients")
        .select("name, phone")
        .eq("id", client_id)
        .maybeSingle();

      if (!client) return errorResponse("Cliente não encontrado");

      // Create Pix payment via Mercado Pago API
      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.access_token}`,
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          transaction_amount: Number(amount),
          description: description || `Cobrança - ${client.name}`,
          payment_method_id: "pix",
          payer: {
            first_name: client.name.split(" ")[0],
            last_name: client.name.split(" ").slice(1).join(" ") || client.name.split(" ")[0],
            email: `${client.phone}@placeholder.com`,
          },
        }),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("Mercado Pago error:", JSON.stringify(mpData));
        // Return structured error with fallback info instead of 500
        const fixedPixKey = config.pix_key || "";
        return jsonResponse({
          success: false,
          error: mpData.message || "Erro no Mercado Pago",
          fallback_pix_key: fixedPixKey,
        }, 200);
      }

      const pixInfo = mpData.point_of_interaction?.transaction_data;

      // Save payment link
      const { data: paymentLink, error: insertError } = await supabase
        .from("payment_links")
        .insert({
          user_id: user.id,
          client_id,
          amount: Number(amount),
          description: description || `Cobrança - ${client.name}`,
          status: "pending",
          mp_payment_id: String(mpData.id),
          qr_code_base64: pixInfo?.qr_code_base64 || null,
          pix_copy_paste: pixInfo?.qr_code || null,
          expires_at: mpData.date_of_expiration || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return errorResponse("Erro ao salvar link de pagamento", 500);
      }

      return jsonResponse({
        success: true,
        payment_link_id: paymentLink.id,
        pix_copy_paste: pixInfo?.qr_code || null,
        qr_code_base64: pixInfo?.qr_code_base64 || null,
      });
    }

    if (action === "list-payments") {
      const { data: payments } = await supabase
        .from("payment_links")
        .select("*, clients(name, phone)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      return jsonResponse({ payments: payments || [] });
    }

    return errorResponse("Ação desconhecida: " + action);
  } catch (err) {
    console.error("Mercado Pago function error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return errorResponse(message, 500);
  }
});
