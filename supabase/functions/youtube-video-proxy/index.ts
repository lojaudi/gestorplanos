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
  "https://pipedapi.r4fo.com",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.ngn.tf",
];

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.fdn.fr",
  "https://invidious.nerdvpn.de",
  "https://vid.puffyan.us",
  "https://invidious.privacyredirect.com",
  "https://invidious.protokolla.fi",
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

    const errors: string[] = [];

    // Strategy 1: Try Piped API instances
    for (const instance of PIPED_INSTANCES) {
      try {
        console.log(`Trying Piped: ${instance}`);
        const infoRes = await fetch(`${instance}/streams/${videoId}`, {
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!infoRes.ok) {
          const txt = await infoRes.text().catch(() => "");
          errors.push(`Piped ${instance}: ${infoRes.status} ${txt.slice(0, 100)}`);
          continue;
        }
        const info = await infoRes.json();

        const streams = info.videoStreams || [];
        console.log(`Piped ${instance}: found ${streams.length} video streams`);

        // Prefer 360p/480p mp4, then any mp4, then any stream
        const target =
          streams.find((s: any) => s.quality === "360p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "480p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "720p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "360p") ||
          streams.find((s: any) => s.quality === "480p") ||
          streams.find((s: any) => s.mimeType?.includes("mp4")) ||
          streams[0];

        if (!target?.url) {
          errors.push(`Piped ${instance}: no usable stream URL`);
          continue;
        }

        console.log(`Piped: fetching stream ${target.quality} ${target.mimeType}`);
        const videoRes = await fetch(target.url, {
          signal: AbortSignal.timeout(60000),
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!videoRes.ok) {
          errors.push(`Piped stream fetch failed: ${videoRes.status}`);
          continue;
        }

        console.log("Piped: streaming video response");
        return new Response(videoRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": target.mimeType || "video/mp4",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (e) {
        errors.push(`Piped ${instance}: ${e instanceof Error ? e.message : "unknown error"}`);
        continue;
      }
    }

    // Strategy 2: Try Invidious API instances
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        console.log(`Trying Invidious: ${instance}`);
        const infoRes = await fetch(
          `${instance}/api/v1/videos/${videoId}?fields=formatStreams,adaptiveFormats`,
          {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          }
        );
        if (!infoRes.ok) {
          const txt = await infoRes.text().catch(() => "");
          errors.push(`Invidious ${instance}: ${infoRes.status} ${txt.slice(0, 100)}`);
          continue;
        }
        const info = await infoRes.json();

        // Try formatStreams first (combined audio+video, more compatible)
        const combined = info.formatStreams || [];
        const adaptive = info.adaptiveFormats || [];
        console.log(`Invidious ${instance}: ${combined.length} combined, ${adaptive.length} adaptive`);

        const combinedTarget =
          combined.find((s: any) => s.qualityLabel === "360p") ||
          combined.find((s: any) => s.qualityLabel === "480p") ||
          combined.find((s: any) => s.qualityLabel === "720p") ||
          combined[0];

        const adaptiveTarget =
          adaptive.find((s: any) => s.qualityLabel === "360p" && s.type?.includes("mp4")) ||
          adaptive.find((s: any) => s.qualityLabel === "480p" && s.type?.includes("mp4")) ||
          adaptive.find((s: any) => s.qualityLabel === "360p") ||
          adaptive.find((s: any) => s.qualityLabel === "480p");

        const target = combinedTarget || adaptiveTarget;
        if (!target?.url) {
          errors.push(`Invidious ${instance}: no usable stream URL`);
          continue;
        }

        console.log(`Invidious: fetching stream ${target.qualityLabel} ${target.type}`);
        const videoRes = await fetch(target.url, {
          signal: AbortSignal.timeout(60000),
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!videoRes.ok) {
          errors.push(`Invidious stream fetch failed: ${videoRes.status}`);
          continue;
        }

        console.log("Invidious: streaming video response");
        return new Response(videoRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": target.type?.split(";")[0] || "video/mp4",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (e) {
        errors.push(`Invidious ${instance}: ${e instanceof Error ? e.message : "unknown error"}`);
        continue;
      }
    }

    console.error("All sources failed:", JSON.stringify(errors));
    return new Response(
      JSON.stringify({ error: "Não foi possível obter o vídeo de nenhuma fonte", details: errors }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Proxy error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
