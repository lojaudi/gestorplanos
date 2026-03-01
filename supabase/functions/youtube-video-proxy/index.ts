import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function streamVideo(url: string, label: string, extraHeaders?: Record<string, string>): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(90000),
      headers: { "User-Agent": UA, Referer: "https://www.youtube.com/", ...extraHeaders },
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`${label}: stream HTTP ${res.status}`);
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
    console.log(`${label}: stream error - ${e instanceof Error ? e.message : "unknown"}`);
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
      return new Response(JSON.stringify({ error: "videoId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: string[] = [];

    // ── Strategy 1: Cobalt API (most reliable) ──
    const COBALT_INSTANCES = [
      "https://api.cobalt.tools",
      "https://cobalt-api.kwiatekmiki.com",
      "https://cobalt.canine.tools",
    ];

    for (const cobaltBase of COBALT_INSTANCES) {
      try {
        console.log(`Strategy 1: Cobalt ${cobaltBase}`);
        const cobaltRes = await fetch(`${cobaltBase}/`, {
          method: "POST",
          signal: AbortSignal.timeout(20000),
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
          errors.push(`Cobalt ${cobaltBase}: ${cobaltRes.status} - ${txt.slice(0, 100)}`);
          continue;
        }

        const cobaltData = await cobaltRes.json();
        console.log(`Cobalt ${cobaltBase}: status=${cobaltData.status}`);

        const downloadUrl = cobaltData.url;
        if (downloadUrl) {
          console.log(`Cobalt ${cobaltBase}: got URL, streaming...`);
          const streamRes = await streamVideo(downloadUrl, `Cobalt ${cobaltBase}`);
          if (streamRes) return streamRes;
        } else {
          errors.push(`Cobalt ${cobaltBase}: no URL in response (status: ${cobaltData.status})`);
        }
      } catch (e) {
        errors.push(`Cobalt ${cobaltBase}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // ── Strategy 2: Innertube ANDROID client ──
    try {
      console.log("Strategy 2: Innertube ANDROID");
      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w&prettyPrint=false",
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "com.google.android.youtube/19.02.39 (Linux; U; Android 14) gzip",
            "X-YouTube-Client-Name": "3",
            "X-YouTube-Client-Version": "19.02.39",
          },
          body: JSON.stringify({
            videoId,
            context: {
              client: {
                clientName: "ANDROID",
                clientVersion: "19.02.39",
                androidSdkVersion: 34,
                hl: "pt",
                gl: "BR",
                osName: "Android",
                osVersion: "14",
                platform: "MOBILE",
              },
            },
            playbackContext: {
              contentPlaybackContext: { html5Preference: "HTML5_PREF_WANTS" },
            },
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const sd = data?.streamingData;
        const formats = [...(sd?.formats || []), ...(sd?.adaptiveFormats || [])];
        const directMp4 = formats
          .filter((f: any) => f.url && f.mimeType?.includes("video/mp4"))
          .sort((a: any, b: any) => (a.height || 0) - (b.height || 0));
        console.log(`ANDROID: ${formats.length} total, ${directMp4.length} direct MP4`);

        const target =
          directMp4.find((f: any) => f.height === 360) ||
          directMp4.find((f: any) => f.height === 480) ||
          directMp4.find((f: any) => f.height && f.height <= 720) ||
          directMp4[0];

        if (target?.url) {
          console.log(`ANDROID: streaming ${target.height}p`);
          const streamRes = await streamVideo(target.url, "ANDROID");
          if (streamRes) return streamRes;
        } else {
          const cipherCount = formats.filter((f: any) => f.signatureCipher).length;
          errors.push(`ANDROID: no direct URLs (${cipherCount} cipher, ${formats.length} total)`);
        }
      } else {
        errors.push(`ANDROID: ${res.status}`);
      }
    } catch (e) {
      errors.push(`ANDROID: ${e instanceof Error ? e.message : "error"}`);
    }

    // ── Strategy 3: Innertube TVHTML5_SIMPLY_EMBEDDED_PLAYER ──
    try {
      console.log("Strategy 3: Innertube EMBEDDED");
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
              thirdParty: { embedUrl: "https://www.youtube.com/" },
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const sd = data?.streamingData;
        const formats = [...(sd?.formats || []), ...(sd?.adaptiveFormats || [])];
        const directMp4 = formats
          .filter((f: any) => f.url && f.mimeType?.includes("video/mp4"))
          .sort((a: any, b: any) => (a.height || 0) - (b.height || 0));
        console.log(`EMBEDDED: ${formats.length} total, ${directMp4.length} direct MP4`);

        const target =
          directMp4.find((f: any) => f.height === 360) ||
          directMp4.find((f: any) => f.height === 480) ||
          directMp4.find((f: any) => f.height && f.height <= 720) ||
          directMp4[0];

        if (target?.url) {
          const streamRes = await streamVideo(target.url, "EMBEDDED");
          if (streamRes) return streamRes;
        } else {
          errors.push(`EMBEDDED: no direct URLs (${formats.length} total)`);
        }
      } else {
        errors.push(`EMBEDDED: ${res.status}`);
      }
    } catch (e) {
      errors.push(`EMBEDDED: ${e instanceof Error ? e.message : "error"}`);
    }

    // ── Strategy 4: Invidious instances ──
    const INVIDIOUS = [
      "https://inv.nadeko.net",
      "https://invidious.jing.rocks",
      "https://yewtu.be",
      "https://vid.puffyan.us",
    ];

    for (const instance of INVIDIOUS) {
      try {
        console.log(`Strategy 4: Invidious ${instance}`);
        const infoRes = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": UA, Accept: "application/json" },
        });
        if (!infoRes.ok) {
          errors.push(`Invidious ${instance}: ${infoRes.status}`);
          continue;
        }
        const info = await infoRes.json();
        const combined = (info.formatStreams || [])
          .filter((s: any) => (s.type || "").includes("video/mp4"));

        const target =
          combined.find((s: any) => s.quality?.includes("360")) ||
          combined.find((s: any) => s.quality?.includes("480")) ||
          combined[0];

        if (target?.url) {
          console.log(`Invidious ${instance}: streaming ${target.quality}`);
          const streamRes = await streamVideo(target.url, `Invidious ${instance}`);
          if (streamRes) return streamRes;
        } else {
          errors.push(`Invidious ${instance}: no MP4 stream`);
        }
      } catch (e) {
        errors.push(`Invidious ${instance}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // ── Strategy 5: Piped instances ──
    const PIPED = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.r4fo.com",
      "https://piped-api.lunar.icu",
    ];

    for (const instance of PIPED) {
      try {
        console.log(`Strategy 5: Piped ${instance}`);
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
        const target =
          streams.find((s: any) => s.quality === "360p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.quality === "480p" && s.mimeType?.includes("mp4")) ||
          streams.find((s: any) => s.mimeType?.includes("mp4"));

        if (target?.url) {
          console.log(`Piped ${instance}: streaming ${target.quality}`);
          const streamRes = await streamVideo(target.url, `Piped ${instance}`);
          if (streamRes) return streamRes;
        } else {
          errors.push(`Piped ${instance}: no MP4 stream`);
        }
      } catch (e) {
        errors.push(`Piped ${instance}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    console.error("All strategies failed:", JSON.stringify(errors));
    return new Response(
      JSON.stringify({ error: "Não foi possível obter o vídeo", details: errors }),
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
