import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getToday(): string {
  const now = new Date();
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().split("T")[0];
}

function getTomorrow(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000 + 86400000);
  return brt.toISOString().split("T")[0];
}

function getYesterday(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000 - 86400000);
  return brt.toISOString().split("T")[0];
}

async function evolutionFetch(apiUrl: string, apiKey: string, path: string, method = "GET", body?: unknown) {
  const url = `${apiUrl.replace(/\/$/, "")}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", apikey: apiKey },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const today = getToday();
    const tomorrow = getTomorrow();
    const yesterday = getYesterday();

    // Get current BRT hour
    const nowBrt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const currentHour = nowBrt.getHours();

    console.log(`[auto-billing] Running for today=${today}, tomorrow=${tomorrow}, yesterday=${yesterday}, currentHour=${currentHour} BRT`);

    // Get all users with automation enabled
    const { data: configs, error: configErr } = await supabase
      .from("billing_automation_config")
      .select("*")
      .eq("is_enabled", true);

    if (configErr) {
      console.error("Error fetching configs:", configErr);
      return new Response(JSON.stringify({ error: configErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!configs || configs.length === 0) {
      console.log("[auto-billing] No users with automation enabled");
      return new Response(JSON.stringify({ message: "No automation configs active", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalErrors = 0;

    for (const config of configs) {
      const userId = config.user_id;
      console.log(`[auto-billing] Processing user: ${userId}`);

      // Check if user's plan is expired beyond 10-day grace period
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("plan_expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (userProfile?.plan_expires_at) {
        const expiresAt = new Date(userProfile.plan_expires_at);
        const gracePeriodEnd = new Date(expiresAt.getTime() + 10 * 24 * 60 * 60 * 1000);
        if (new Date() > gracePeriodEnd) {
          console.log(`[auto-billing] User ${userId} plan expired beyond 10-day grace period, skipping`);
          continue;
        }
      }

      // Get user's WhatsApp config
      const { data: waConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("user_id", userId)
        .eq("is_connected", true)
        .maybeSingle();

      if (!waConfig) {
        console.log(`[auto-billing] User ${userId} has no connected WhatsApp instance, skipping`);
        continue;
      }

      // Get global WhatsApp config for API URL/key
      const { data: globalWa } = await supabase
        .from("whatsapp_global_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!globalWa) {
        console.log(`[auto-billing] No global WhatsApp config found, skipping`);
        continue;
      }

      // Get user's clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, phone, due_date, username, plan_id, service_id")
        .eq("user_id", userId);

      if (!clients || clients.length === 0) continue;

      // Get user's templates
      const { data: templates } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", userId);

      if (!templates || templates.length === 0) {
        console.log(`[auto-billing] User ${userId} has no templates, skipping`);
        continue;
      }

      // Get user's services and plans for template resolution
      const { data: userServices } = await supabase.from("services").select("id, name").eq("user_id", userId);
      const { data: userPlans } = await supabase.from("plans").select("id, name, price").eq("user_id", userId);

      // Get user's payment config
      const { data: payConfig } = await supabase
        .from("payment_gateway_config")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "mercado_pago")
        .maybeSingle();

      const gatewayEnabled = payConfig?.is_enabled || false;
      const fixedPixKey = payConfig?.pix_key || "";

      // Determine which notifications to send
      const notifications: { client: typeof clients[0]; type: string; templateType: string }[] = [];

      // Get per-type send hours (fallback to send_hour for backwards compat)
      const hourBeforeDue = config.send_hour_before_due ?? config.send_hour ?? 10;
      const hourOnDue = config.send_hour_on_due ?? config.send_hour ?? 10;
      const hourAfterDue = config.send_hour_after_due ?? config.send_hour ?? 15;

      for (const client of clients) {
        // 1 day before due (tomorrow is due date) - check hour matches
        if (config.notify_before_due && client.due_date === tomorrow && currentHour === hourBeforeDue) {
          notifications.push({ client, type: "before_due", templateType: "vencendo_amanha" });
        }
        // On due date
        if (config.notify_on_due && client.due_date === today && currentHour === hourOnDue) {
          notifications.push({ client, type: "on_due", templateType: "vencendo_hoje" });
        }
        // 1 day after due (yesterday was due date)
        if (config.notify_after_due && client.due_date === yesterday && currentHour === hourAfterDue) {
          notifications.push({ client, type: "after_due", templateType: "vencido" });
        }
      }

      if (notifications.length === 0) {
        console.log(`[auto-billing] No notifications needed for user ${userId}`);
        continue;
      }

      // Filter out already-sent notifications
      const filteredNotifications = [];
      for (const n of notifications) {
        const { data: existing } = await supabase
          .from("billing_notifications_log")
          .select("id")
          .eq("user_id", userId)
          .eq("client_id", n.client.id)
          .eq("notification_type", n.type)
          .eq("due_date", n.client.due_date)
          .maybeSingle();

        if (!existing) filteredNotifications.push(n);
      }

      if (filteredNotifications.length === 0) {
        console.log(`[auto-billing] All notifications already sent for user ${userId}`);
        continue;
      }

      console.log(`[auto-billing] Sending ${filteredNotifications.length} notifications for user ${userId}`);

      // Find matching template for each notification type
      const resolveTemplate = (template: { content: string }, client: typeof clients[0], pixCode?: string, paymentLinkId?: string) => {
        const serviceName = (userServices || []).find((s: any) => s.id === client.service_id)?.name || "";
        const plan = (userPlans || []).find((p: any) => p.id === client.plan_id);
        const planName = plan?.name || "";
        const planPrice = plan?.price != null ? Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
        const dueDate = new Date(client.due_date + "T12:00:00");
        const formattedDue = dueDate.toLocaleDateString("pt-BR");
        const nextDue = new Date(dueDate);
        nextDue.setMonth(nextDue.getMonth() + 1);
        const formattedNextDue = nextDue.toLocaleDateString("pt-BR");
        const paymentLink = paymentLinkId ? `https://gestorplanos.lovable.app/pay?id=${paymentLinkId}` : (pixCode || "");

        return template.content
          .replace(/{nome}/g, client.name)
          .replace(/{servico}/g, serviceName)
          .replace(/{plano}/g, planName)
          .replace(/{valor_plano}/g, planPrice)
          .replace(/{data_vencimento}/g, formattedDue)
          .replace(/{data_pagamento}/g, new Date().toLocaleDateString("pt-BR"))
          .replace(/{proximo_vencimento}/g, formattedNextDue)
          .replace(/{link_pagamento}/g, paymentLink)
          .replace(/{meio_de_pagamento}/g, pixCode || "");
      };

      // Send messages
      for (const n of filteredNotifications) {
        // Find best matching template
        const template = templates.find((t: any) => t.type === n.templateType) || templates[0];
        if (!template) continue;

        let pixCode = "";
        let paymentLinkId = "";

        // Generate Pix if needed
        const hasMeioPagamento = template.content.includes("{meio_de_pagamento}");
        const hasLinkPagamento = template.content.includes("{link_pagamento}");

        if ((hasMeioPagamento || hasLinkPagamento) && gatewayEnabled && payConfig?.access_token) {
          const plan = (userPlans || []).find((p: any) => p.id === n.client.plan_id);
          const amount = plan?.price;
          if (amount && amount > 0) {
            try {
              const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${payConfig.access_token}`,
                  "X-Idempotency-Key": crypto.randomUUID(),
                },
                body: JSON.stringify({
                  transaction_amount: Number(amount),
                  description: `Cobrança - ${n.client.name}`,
                  payment_method_id: "pix",
                  payer: {
                    first_name: n.client.name.split(" ")[0],
                    last_name: n.client.name.split(" ").slice(1).join(" ") || n.client.name.split(" ")[0],
                    email: `${n.client.phone}@placeholder.com`,
                  },
                }),
              });
              const mpData = await mpResponse.json();
              if (mpResponse.ok) {
                const pixInfo = mpData.point_of_interaction?.transaction_data;
                pixCode = pixInfo?.qr_code || "";

                // Save payment link
                const { data: paymentLink } = await supabase
                  .from("payment_links")
                  .insert({
                    user_id: userId,
                    client_id: n.client.id,
                    amount: Number(amount),
                    description: `Cobrança automática - ${n.client.name}`,
                    status: "pending",
                    mp_payment_id: String(mpData.id),
                    qr_code_base64: pixInfo?.qr_code_base64 || null,
                    pix_copy_paste: pixInfo?.qr_code || null,
                    expires_at: mpData.date_of_expiration || null,
                  })
                  .select("id")
                  .single();

                paymentLinkId = paymentLink?.id || "";
              }
            } catch (err) {
              console.error(`[auto-billing] Pix error for ${n.client.name}:`, err);
            }
          }
        } else if ((hasMeioPagamento || hasLinkPagamento) && !gatewayEnabled && fixedPixKey) {
          pixCode = fixedPixKey;
        }

        const message = resolveTemplate(template, n.client, pixCode, paymentLinkId);

        // Send via WhatsApp
        try {
          await evolutionFetch(
            globalWa.api_url,
            globalWa.api_key,
            `/message/sendText/${waConfig.instance_name}`,
            "POST",
            {
              number: n.client.phone,
              text: message,
            }
          );

          // Log the notification
          await supabase.from("billing_notifications_log").insert({
            user_id: userId,
            client_id: n.client.id,
            notification_type: n.type,
            due_date: n.client.due_date,
            status: "sent",
            message_content: message,
          });

          // Also log in message_logs
          await supabase.from("message_logs").insert({
            user_id: userId,
            client_id: n.client.id,
            message_content: message,
            status: "sent",
            template_type: `auto_${n.type}`,
          });

          totalSent++;
          console.log(`[auto-billing] Sent ${n.type} to ${n.client.name}`);

          // Anti-spam delay
          await new Promise((r) => setTimeout(r, 1500));
        } catch (sendErr) {
          console.error(`[auto-billing] Send error for ${n.client.name}:`, sendErr);
          totalErrors++;

          await supabase.from("billing_notifications_log").insert({
            user_id: userId,
            client_id: n.client.id,
            notification_type: n.type,
            due_date: n.client.due_date,
            status: "error",
            message_content: message,
          });
        }
      }
    }

    console.log(`[auto-billing] Done. Sent: ${totalSent}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: totalErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[auto-billing] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
