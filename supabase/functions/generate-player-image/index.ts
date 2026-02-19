import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known popular teams get priority
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
    // teams: [{ name: string, colors?: string }]

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

    console.log("Generating player image for team:", bestTeam.name);

    const prompt = `Generate a photorealistic image of a professional football/soccer player in action pose, wearing the official jersey/kit of ${bestTeam.name}. The player should be a generic athletic male player (not a real person), shown from the waist up in a dynamic pose. The background should be transparent or very dark/black. The image should be high quality, dramatic lighting, suitable for a sports banner. Portrait orientation. The jersey should clearly show the team colors of ${bestTeam.name}. No text or watermarks.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

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

    console.log("Player image generated and uploaded:", publicUrl);

    return new Response(
      JSON.stringify({ url: publicUrl, team: bestTeam.name }),
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
