import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

    // ── Strategy 1: Cobalt API (most reliable) ──
    const COBALT_INSTANCES = [
      "https://api.cobalt.tools",
      "https://cobalt-api.kwiatekmiki.com",
      "https://cobalt.api.timelessnesses.me",
    ];

    for (const instance of COBALT_INSTANCES) {
      try {
        console.log(`Trying Cobalt: ${instance}`);
        const res = await fetch(`${instance}/`, {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": UA,
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            videoQuality: "480",
            filenameStyle: "basic",
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        console.log(`Cobalt ${instance}: status=${res.status} ct=${contentType}`);
        
        if (!contentType.includes("json")) {
          // Might be returning the video directly
          if (res.ok && (contentType.includes("video") || contentType.includes("octet"))) {
            console.log("Cobalt returned video directly!");
            return new Response(res.body, {
              headers: {
                ...corsHeaders,
                "Content-Type": contentType || "video/mp4",
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
          const txt = await res.text().catch(() => "");
          errors.push(`Cobalt ${instance}: non-json ${res.status} ${txt.slice(0, 100)}`);
          continue;
        }

        const data = await res.json();
        console.log(`Cobalt response: status=${data.status}`);

        let streamUrl: string | null = null;

        if (data.status === "redirect" || data.status === "stream" || data.status === "tunnel") {
          streamUrl = data.url;
        } else if (data.status === "picker" && data.picker?.length > 0) {
          streamUrl = data.picker[0].url;
        } else if (data.url) {
          streamUrl = data.url;
        }

        if (!streamUrl) {
          errors.push(`Cobalt ${instance}: status=${data.status}, no url. text=${data.text || ""}`);
          continue;
        }

        console.log(`Cobalt: fetching stream from ${streamUrl.slice(0, 80)}...`);
        const videoRes = await fetch(streamUrl, {
          signal: AbortSignal.timeout(120000),
          headers: { "User-Agent": UA },
        });

        if (!videoRes.ok) {
          errors.push(`Cobalt stream fetch: ${videoRes.status}`);
          continue;
        }

        const vct = videoRes.headers.get("content-type") || "video/mp4";
        console.log(`Cobalt stream OK, ct=${vct}`);
        return new Response(videoRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": vct.split(";")[0],
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        console.log(`Cobalt ${instance} error: ${msg}`);
        errors.push(`Cobalt ${instance}: ${msg}`);
      }
    }

    // ── Strategy 2: YouTube innertube (for videos with direct URLs) ──
    try {
      console.log("Trying innertube ANDROID client...");
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "19.09.37",
              androidSdkVersion: 30,
              hl: "pt",
              gl: "BR",
            },
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const sd = data?.streamingData;
        const formats = [...(sd?.formats || []), ...(sd?.adaptiveFormats || [])];
        console.log(`Innertube: ${formats.length} total formats`);

        // Find formats with direct URLs (not signatureCipher)
        const directFormats = formats
          .filter((f: any) => f.url && f.mimeType?.includes("video/mp4"))
          .sort((a: any, b: any) => (a.height || 0) - (b.height || 0));

        console.log(`Innertube: ${directFormats.length} direct URL formats`);

        const target = directFormats.find((f: any) => f.height === 360) ||
                       directFormats.find((f: any) => f.height === 480) ||
                       directFormats.find((f: any) => f.height <= 720) ||
                       directFormats[0];

        if (target?.url) {
          console.log(`Innertube: fetching ${target.height}p...`);
          const videoRes = await fetch(target.url, {
            signal: AbortSignal.timeout(120000),
            headers: { "User-Agent": UA, "Referer": "https://www.youtube.com/" },
          });

          if (videoRes.ok) {
            return new Response(videoRes.body, {
              headers: {
                ...corsHeaders,
                "Content-Type": "video/mp4",
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
          errors.push(`Innertube stream fetch: ${videoRes.status}`);
        } else {
          const cipherCount = formats.filter((f: any) => f.signatureCipher).length;
          errors.push(`Innertube: no direct URLs (${cipherCount} cipher-only)`);
        }
      } else {
        errors.push(`Innertube: ${res.status}`);
      }
    } catch (e) {
      errors.push(`Innertube: ${e instanceof Error ? e.message : "error"}`);
    }

    // ── Strategy 3: Piped fallback ──
    const PIPED = ["https://pipedapi.kavin.rocks", "https://pipedapi.adminforge.de"];
    for (const instance of PIPED) {
      try {
        console.log(`Fallback Piped: ${instance}`);
        const infoRes = await fetch(`${instance}/streams/${videoId}`, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": UA },
        });
        if (!infoRes.ok) { errors.push(`Piped ${instance}: ${infoRes.status}`); continue; }
        const info = await infoRes.json();
        const streams = info.videoStreams || [];
        const target = streams.find((s: any) => s.quality === "360p" && s.mimeType?.includes("mp4")) ||
                       streams.find((s: any) => s.quality === "480p") || streams[0];
        if (!target?.url) { errors.push(`Piped ${instance}: no stream`); continue; }
        const vRes = await fetch(target.url, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": UA } });
        if (!vRes.ok) { errors.push(`Piped stream: ${vRes.status}`); continue; }
        return new Response(vRes.body, {
          headers: { ...corsHeaders, "Content-Type": target.mimeType || "video/mp4", "Cache-Control": "public, max-age=3600" },
        });
      } catch (e) {
        errors.push(`Piped ${instance}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    console.error("All strategies failed:", JSON.stringify(errors));
    return new Response(
      JSON.stringify({ error: "Não foi possível obter o vídeo. Tente novamente mais tarde.", details: errors }),
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
