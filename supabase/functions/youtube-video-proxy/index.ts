import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi-libre.kavin.rocks",
];

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.fdn.fr",
  "https://invidious.nerdvpn.de",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId || typeof videoId !== "string") {
      return new Response(
        JSON.stringify({ error: "videoId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strategy 1: Try Piped API instances
    for (const instance of PIPED_INSTANCES) {
      try {
        const infoRes = await fetch(`${instance}/streams/${videoId}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!infoRes.ok) continue;
        const info = await infoRes.json();

        const streams = info.videoStreams || [];
        // Prefer 360p mp4, then 480p, then any
        const target =
          streams.find((s: any) => s.quality === "360p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "480p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "360p") ||
          streams.find((s: any) => s.quality === "480p") ||
          streams.find((s: any) => s.quality === "720p") ||
          streams[0];

        if (!target?.url) continue;

        const videoRes = await fetch(target.url, {
          signal: AbortSignal.timeout(50000),
        });
        if (!videoRes.ok) continue;

        return new Response(videoRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": target.mimeType || "video/mp4",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        continue;
      }
    }

    // Strategy 2: Try Invidious API instances
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const infoRes = await fetch(
          `${instance}/api/v1/videos/${videoId}?fields=formatStreams,adaptiveFormats`,
          { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (!infoRes.ok) continue;
        const info = await infoRes.json();

        // Try adaptiveFormats (video-only, higher quality control)
        const adaptive = info.adaptiveFormats || [];
        const adaptiveTarget =
          adaptive.find((s: any) => s.qualityLabel === "360p" && s.type?.includes("mp4")) ||
          adaptive.find((s: any) => s.qualityLabel === "480p" && s.type?.includes("mp4")) ||
          adaptive.find((s: any) => s.qualityLabel === "360p") ||
          adaptive.find((s: any) => s.qualityLabel === "480p");

        // Fallback to formatStreams (combined audio+video)
        const combined = info.formatStreams || [];
        const combinedTarget =
          combined.find((s: any) => s.qualityLabel === "360p") ||
          combined.find((s: any) => s.qualityLabel === "480p") ||
          combined[0];

        const target = adaptiveTarget || combinedTarget;
        if (!target?.url) continue;

        const videoRes = await fetch(target.url, {
          signal: AbortSignal.timeout(50000),
        });
        if (!videoRes.ok) continue;

        return new Response(videoRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": target.type?.split(";")[0] || "video/mp4",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        continue;
      }
    }

    return new Response(
      JSON.stringify({ error: "Não foi possível obter o vídeo de nenhuma fonte" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
