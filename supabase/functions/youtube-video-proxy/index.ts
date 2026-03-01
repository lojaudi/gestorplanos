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

    const COBALT_URL = Deno.env.get("COBALT_API_URL");
    if (!COBALT_URL) {
      return new Response(
        JSON.stringify({ error: "COBALT_API_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Requesting video ${videoId} from Cobalt: ${COBALT_URL}`);

    // Step 1: Ask Cobalt for the download URL
    const cobaltRes = await fetch(`${COBALT_URL}/`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoQuality: "480",
        filenameStyle: "basic",
        downloadMode: "auto",
      }),
    });

    if (!cobaltRes.ok) {
      const txt = await cobaltRes.text().catch(() => "");
      console.error(`Cobalt error: ${cobaltRes.status} - ${txt.slice(0, 200)}`);
      return new Response(
        JSON.stringify({ error: "Cobalt request failed", details: txt.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cobaltData = await cobaltRes.json();
    console.log(`Cobalt response: status=${cobaltData.status}`);

    const downloadUrl = cobaltData.url;
    if (!downloadUrl) {
      console.error("Cobalt returned no URL:", JSON.stringify(cobaltData).slice(0, 300));
      return new Response(
        JSON.stringify({ error: "Cobalt returned no download URL", cobaltStatus: cobaltData.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Stream the video back to the client
    console.log(`Streaming video from: ${downloadUrl.slice(0, 80)}...`);
    const videoRes = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(120000),
      headers: {
        "User-Agent": UA,
        Referer: COBALT_URL,
      },
      redirect: "follow",
    });

    if (!videoRes.ok) {
      console.error(`Video stream failed: ${videoRes.status}`);
      return new Response(
        JSON.stringify({ error: "Failed to download video stream", status: videoRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ct = videoRes.headers.get("content-type") || "video/mp4";
    return new Response(videoRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": ct.includes("video") ? ct.split(";")[0] : "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Proxy error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
