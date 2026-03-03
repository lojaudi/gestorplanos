import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    if (!videoId || typeof videoId !== "string") {
      return new Response(JSON.stringify({ error: "videoId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawCobaltUrl = Deno.env.get("COBALT_API_URL");
    if (!rawCobaltUrl) {
      return new Response(
        JSON.stringify({ error: "COBALT_API_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const COBALT_URL = rawCobaltUrl.replace(/\/+$/, "") + "/";
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Try multiple strategies
    const strategies = [
      { label: "default", body: { url: youtubeUrl, videoQuality: "360", filenameStyle: "basic", downloadMode: "auto" } },
      { label: "youtubeHLS", body: { url: youtubeUrl, videoQuality: "360", filenameStyle: "basic", downloadMode: "auto", youtubeHLS: true } },
      { label: "720p", body: { url: youtubeUrl, videoQuality: "720", filenameStyle: "basic", downloadMode: "auto", youtubeHLS: true } },
    ];

    let lastError = "";

    for (const strategy of strategies) {
      console.log(`[yt-proxy] Trying strategy "${strategy.label}" for ${videoId}`);

      try {
        const cobaltRes = await fetch(COBALT_URL, {
          method: "POST",
          signal: AbortSignal.timeout(25000),
          redirect: "manual",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": UA,
          },
          body: JSON.stringify(strategy.body),
        });

        console.log(`[yt-proxy] Strategy "${strategy.label}": status=${cobaltRes.status}`);

        if (cobaltRes.status >= 300 && cobaltRes.status < 400) {
          const loc = cobaltRes.headers.get("location");
          lastError = `Redirect ${cobaltRes.status} -> ${loc}`;
          continue;
        }

        if (!cobaltRes.ok) {
          const txt = await cobaltRes.text().catch(() => "");
          console.warn(`[yt-proxy] Strategy "${strategy.label}" failed: ${cobaltRes.status} - ${txt.slice(0, 200)}`);
          lastError = txt.slice(0, 300);
          
          // If it's a youtube.login error, try next strategy
          if (txt.includes("youtube.login") || txt.includes("youtube.auth")) {
            continue;
          }
          // For other errors, also try next
          continue;
        }

        const cobaltData = await cobaltRes.json();
        const downloadUrl = cobaltData.url;
        console.log(`[yt-proxy] Strategy "${strategy.label}" success: status=${cobaltData.status}, url=${downloadUrl?.slice(0, 120)}`);

        if (!downloadUrl) {
          lastError = `No URL in response: ${JSON.stringify(cobaltData).slice(0, 200)}`;
          continue;
        }

        // Follow redirects to get final URL
        let finalUrl = downloadUrl;
        for (let r = 0; r < 10; r++) {
          const checkRes = await fetch(finalUrl, {
            method: "HEAD",
            redirect: "manual",
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": UA },
          });
          if (checkRes.status >= 300 && checkRes.status < 400) {
            const location = checkRes.headers.get("location");
            if (location) {
              finalUrl = location.startsWith("http") ? location : new URL(location, finalUrl).href;
              continue;
            }
          }
          break;
        }

        console.log(`[yt-proxy] Final URL: ${finalUrl.slice(0, 120)}`);

        // Stream the video
        const videoRes = await fetch(finalUrl, {
          signal: AbortSignal.timeout(50000),
          redirect: "follow",
          headers: { "User-Agent": UA },
        });

        if (!videoRes.ok || !videoRes.body) {
          lastError = `Video fetch failed: ${videoRes.status}`;
          continue;
        }

        const contentType = videoRes.headers.get("content-type") || "video/mp4";
        const contentLength = videoRes.headers.get("content-length");
        console.log(`[yt-proxy] Streaming: type=${contentType}, size=${contentLength || "?"}`);

        const responseHeaders: Record<string, string> = {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        };
        if (contentLength) responseHeaders["Content-Length"] = contentLength;

        return new Response(videoRes.body, { status: 200, headers: responseHeaders });

      } catch (strategyErr) {
        const msg = strategyErr instanceof Error ? strategyErr.message : "Unknown";
        console.warn(`[yt-proxy] Strategy "${strategy.label}" exception: ${msg}`);
        lastError = msg;
        continue;
      }
    }

    // All strategies failed
    return new Response(
      JSON.stringify({ error: "All download strategies failed", details: lastError }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[yt-proxy] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
