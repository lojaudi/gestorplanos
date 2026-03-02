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
    console.log(`[yt-proxy] Requesting video ${videoId} from Cobalt: ${COBALT_URL}`);

    // Step 1: Get download URL from Cobalt (manual redirect to debug)
    const cobaltRes = await fetch(COBALT_URL, {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoQuality: "360",
        filenameStyle: "basic",
        downloadMode: "auto",
      }),
    });

    console.log(`[yt-proxy] Cobalt response status: ${cobaltRes.status}, headers: ${JSON.stringify(Object.fromEntries(cobaltRes.headers.entries()))}`);

    if (cobaltRes.status >= 300 && cobaltRes.status < 400) {
      const loc = cobaltRes.headers.get("location");
      return new Response(
        JSON.stringify({ error: "Cobalt redirect", status: cobaltRes.status, location: loc, url_used: COBALT_URL }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cobaltRes.ok) {
      const txt = await cobaltRes.text().catch(() => "");
      console.error(`[yt-proxy] Cobalt error: ${cobaltRes.status} - ${txt.slice(0, 300)}`);
      return new Response(
        JSON.stringify({ error: "Cobalt request failed", status: cobaltRes.status, details: txt.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cobaltData = await cobaltRes.json();
    const downloadUrl = cobaltData.url;
    console.log(`[yt-proxy] Cobalt response: status=${cobaltData.status}, url=${downloadUrl?.slice(0, 120)}`);

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "Cobalt returned no download URL", cobaltStatus: cobaltData.status, data: cobaltData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Follow redirects manually (max 10) to get final URL
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
          console.log(`[yt-proxy] Redirect ${r + 1}: ${checkRes.status} -> ${location.slice(0, 100)}`);
          finalUrl = location.startsWith("http") ? location : new URL(location, finalUrl).href;
          continue;
        }
      }
      break;
    }

    console.log(`[yt-proxy] Final URL: ${finalUrl.slice(0, 120)}`);

    // Step 3: Stream the video through this function
    const videoRes = await fetch(finalUrl, {
      signal: AbortSignal.timeout(50000),
      redirect: "follow",
      headers: { "User-Agent": UA },
    });

    if (!videoRes.ok || !videoRes.body) {
      const txt = await videoRes.text().catch(() => "");
      console.error(`[yt-proxy] Video fetch error: ${videoRes.status} - ${txt.slice(0, 200)}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch video", status: videoRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const contentLength = videoRes.headers.get("content-length");
    console.log(`[yt-proxy] Streaming video: type=${contentType}, size=${contentLength || "unknown"}`);

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    return new Response(videoRes.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[yt-proxy] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
