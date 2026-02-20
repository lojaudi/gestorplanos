import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const POPULAR_TEAMS = [
  "flamengo", "corinthians", "palmeiras", "são paulo", "santos", "grêmio",
  "internacional", "atlético", "cruzeiro", "vasco", "fluminense", "botafogo",
  "real madrid", "barcelona", "manchester", "liverpool", "juventus", "milan",
  "bayern", "psg", "river plate", "boca juniors", "racing",
];

function getTeamPriority(name: string): number {
  const lower = name.toLowerCase();
  const idx = POPULAR_TEAMS.findIndex((t) => lower.includes(t));
  return idx >= 0 ? POPULAR_TEAMS.length - idx : -1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teams } = await req.json();

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return new Response(JSON.stringify({ error: "teams array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract user_id from JWT
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
      const userClient = createClient(supabaseUrl, anonKey!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    // Pick the most popular team
    let bestTeam = teams[0];
    let bestPriority = -1;
    for (const t of teams) {
      const p = getTeamPriority(t.name);
      if (p > bestPriority) {
        bestPriority = p;
        bestTeam = t;
      }
    }

    // Check daily cache
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    if (userId) {
      const { data: cached } = await sb
        .from("player_image_cache")
        .select("image_url, team_name")
        .eq("user_id", userId)
        .eq("generated_date", today)
        .maybeSingle();

      if (cached) {
        console.log("Returning cached player image for user:", userId);
        return new Response(
          JSON.stringify({ url: cached.image_url, team: cached.team_name, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Generating player image for team:", bestTeam.name);

    const prompt = `A digital illustration of a soccer player wearing a ${bestTeam.name} jersey, dynamic action pose, dark background, portrait orientation, high quality sports art style, no text.`;

    const attempts = [
      { model: "google/gemini-2.5-flash-image", delay: 0 },
      { model: "google/gemini-3-pro-image-preview", delay: 2000 },
      { model: "google/gemini-2.5-flash-image", delay: 3000 },
    ];
    let aiResponse: Response | null = null;
    let lastError = "";

    for (const { model, delay } of attempts) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      console.log("Trying model:", model, "attempt delay:", delay);
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (resp.ok) {
        aiResponse = resp;
        break;
      }

      lastError = await resp.text();
      console.error(`Model ${model} failed:`, resp.status, lastError);

      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!aiResponse) {
      return new Response(JSON.stringify({ error: "AI generation failed after all retries" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in AI response:", JSON.stringify(aiData).substring(0, 500));
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to Supabase Storage
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const fileName = `player-ai/${Date.now()}-${bestTeam.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    const { error: uploadError } = await sb.storage
      .from("platform-assets")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to save image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { publicUrl } } = sb.storage.from("platform-assets").getPublicUrl(fileName);

    // Save to daily cache
    if (userId) {
      // Delete old entries for this user (keep only today)
      await sb.from("player_image_cache").delete().eq("user_id", userId).neq("generated_date", today);

      const { error: cacheError } = await sb.from("player_image_cache").upsert({
        user_id: userId,
        team_name: bestTeam.name,
        image_url: publicUrl,
        generated_date: today,
      }, { onConflict: "user_id,generated_date" });

      if (cacheError) {
        console.error("Cache save error:", cacheError);
        // Non-critical, continue
      }
    }

    console.log("Player image generated and uploaded:", publicUrl);

    return new Response(
      JSON.stringify({ url: publicUrl, team: bestTeam.name, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
