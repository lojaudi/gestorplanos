import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Helpers ──

function pickMp4Stream(streams: any[]): any | null {
  // Prefer combined (video+audio) mp4, 360-480p
  const combined = streams
    .filter((s: any) => {
      const mime = (s.mimeType || s.type || "").toLowerCase();
      return mime.includes("video/mp4") && !mime.includes("audio/");
    })
    .sort((a: any, b: any) => (a.height || a.quality ? parseInt(a.quality) : 0) - (b.height || b.quality ? parseInt(b.quality) : 0));

  return (
    combined.find((s: any) => (s.height || parseInt(s.quality)) === 360) ||
    combined.find((s: any) => (s.height || parseInt(s.quality)) === 480) ||
    combined.find((s: any) => (s.height || parseInt(s.quality)) <= 720) ||
    combined[0] ||
    null
  );
}

async function fetchAndStream(url: string, errors: string[], label: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(90000),
      headers: { "User-Agent": UA, Referer: "https://www.youtube.com/" },
    });
    if (!res.ok) {
      errors.push(`${label} stream: ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "video/mp4";
    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": ct.includes("video") ? ct.split(";")[0] : "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    errors.push(`${label} stream: ${e instanceof Error ? e.message : "error"}`);
    return null;
  }
}

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

    // ── Strategy 1: Innertube TVHTML5_SIMPLY_EMBEDDED_PLAYER ──
    // This client works well for embeddable videos like trailers
    try {
      console.log("Strategy 1: Innertube EMBEDDED player");
      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: { "Content-Type": "application/json", "User-Agent": UA },
          body: JSON.stringify({
            videoId,
            context: {
              client: {
                clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                clientVersion: "2.0",
                hl: "pt",
                gl: "BR",
              },
              thirdParty: {
                embedUrl: "https://www.youtube.com/",
              },
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const sd = data?.streamingData;
        const formats = [...(sd?.formats || []), ...(sd?.adaptiveFormats || [])];
        console.log(`Embedded: ${formats.length} formats total`);

        const directFormats = formats
          .filter((f: any) => f.url && f.mimeType?.includes("video/mp4"))
          .sort((a: any, b: any) => (a.height || 0) - (b.height || 0));

        console.log(`Embedded: ${directFormats.length} direct MP4 formats`);

        // Prefer combined (formats with audio), then adaptive
        const combinedFormats = directFormats.filter((f: any) => f.mimeType?.includes("avc1") && !f.mimeType?.includes("audio"));
        const target =
          combinedFormats.find((f: any) => f.height === 360) ||
          combinedFormats.find((f: any) => f.height === 480) ||
          directFormats.find((f: any) => f.height === 360) ||
          directFormats.find((f: any) => f.height === 480) ||
          directFormats.find((f: any) => f.height && f.height <= 720) ||
          directFormats[0];

        if (target?.url) {
          console.log(`Embedded: streaming ${target.height}p (${target.mimeType?.slice(0, 30)})`);
          const streamRes = await fetchAndStream(target.url, errors, "Embedded");
          if (streamRes) return streamRes;
        } else {
          const cipherCount = formats.filter((f: any) => f.signatureCipher).length;
          errors.push(`Embedded: no direct URLs (${cipherCount} cipher, ${formats.length} total)`);
        }
      } else {
        errors.push(`Embedded: ${res.status}`);
      }
    } catch (e) {
      errors.push(`Embedded: ${e instanceof Error ? e.message : "error"}`);
    }

    // ── Strategy 2: Innertube IOS client ──
    try {
      console.log("Strategy 2: Innertube IOS");
      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc&prettyPrint=false",
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
          },
          body: JSON.stringify({
            videoId,
            context: {
              client: {
                clientName: "IOS",
                clientVersion: "19.29.1",
                deviceMake: "Apple",
                deviceModel: "iPhone16,2",
                hl: "pt",
                gl: "BR",
                osName: "iPhone",
                osVersion: "17.5.1.21F90",
              },
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const sd = data?.streamingData;
        const formats = [...(sd?.formats || []), ...(sd?.adaptiveFormats || [])];
        console.log(`IOS: ${formats.length} formats`);

        const directFormats = formats
          .filter((f: any) => f.url && f.mimeType?.includes("video/mp4"))
          .sort((a: any, b: any) => (a.height || 0) - (b.height || 0));

        console.log(`IOS: ${directFormats.length} direct MP4`);

        const target =
          directFormats.find((f: any) => f.height === 360) ||
          directFormats.find((f: any) => f.height === 480) ||
          directFormats.find((f: any) => f.height && f.height <= 720) ||
          directFormats[0];

        if (target?.url) {
          console.log(`IOS: streaming ${target.height}p`);
          const streamRes = await fetchAndStream(target.url, errors, "IOS");
          if (streamRes) return streamRes;
        } else {
          errors.push(`IOS: no direct URLs (${formats.length} total)`);
        }
      } else {
        errors.push(`IOS: ${res.status}`);
      }
    } catch (e) {
      errors.push(`IOS: ${e instanceof Error ? e.message : "error"}`);
    }

    // ── Strategy 3: Invidious instances ──
    const INVIDIOUS = [
      "https://inv.nadeko.net",
      "https://invidious.fdn.fr",
      "https://invidious.nerdvpn.de",
      "https://iv.datura.network",
      "https://invidious.protokolla.fi",
    ];

    for (const instance of INVIDIOUS) {
      try {
        console.log(`Strategy 3: Invidious ${instance}`);
        const infoRes = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": UA, Accept: "application/json" },
        });
        if (!infoRes.ok) {
          errors.push(`Invidious ${instance}: ${infoRes.status}`);
          continue;
        }
        const info = await infoRes.json();
        const streams = [...(info.formatStreams || []), ...(info.adaptiveFormats || [])];
        console.log(`Invidious ${instance}: ${streams.length} streams`);

        // Prefer formatStreams (combined audio+video)
        const combinedMp4 = (info.formatStreams || [])
          .filter((s: any) => (s.type || "").includes("video/mp4"))
          .sort((a: any, b: any) => parseInt(a.quality || "0") - parseInt(b.quality || "0"));

        const target =
          combinedMp4.find((s: any) => s.quality?.includes("360")) ||
          combinedMp4.find((s: any) => s.quality?.includes("480")) ||
          combinedMp4[0];

        if (target?.url) {
          console.log(`Invidious ${instance}: streaming ${target.quality}`);
          const streamRes = await fetchAndStream(target.url, errors, `Invidious ${instance}`);
          if (streamRes) return streamRes;
        } else {
          errors.push(`Invidious ${instance}: no MP4 stream found`);
        }
      } catch (e) {
        errors.push(`Invidious ${instance}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // ── Strategy 4: Piped instances ──
    const PIPED = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.adminforge.de",
      "https://pipedapi.in.projectsegfau.lt",
      "https://api.piped.projectsegfau.lt",
    ];

    for (const instance of PIPED) {
      try {
        console.log(`Strategy 4: Piped ${instance}`);
        const infoRes = await fetch(`${instance}/streams/${videoId}`, {
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": UA },
        });
        if (!infoRes.ok) {
          errors.push(`Piped ${instance}: ${infoRes.status}`);
          continue;
        }
        const info = await infoRes.json();
        const streams = info.videoStreams || [];
        console.log(`Piped ${instance}: ${streams.length} video streams`);

        const target =
          streams.find((s: any) => s.quality === "360p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "480p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.mimeType?.includes("mp4")) ||
          streams[0];

        if (!target?.url) {
          errors.push(`Piped ${instance}: no stream URL`);
          continue;
        }

        const streamRes = await fetchAndStream(target.url, errors, `Piped ${instance}`);
        if (streamRes) return streamRes;
      } catch (e) {
        errors.push(`Piped ${instance}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    console.error("All strategies failed:", JSON.stringify(errors));
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
