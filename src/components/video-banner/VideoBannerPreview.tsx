import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import type { ContentDetails } from "@/pages/VideoBanner";

const TMDB_IMG = "https://image.tmdb.org/t/p";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  selected: ContentDetails;
  logoUrl: string | null;
  onBack: () => void;
}

// ── Image helpers ──

async function loadImageViaProxy(url: string): Promise<HTMLImageElement> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/image-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("Proxy error");
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ── Drawing helpers ──

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCircularImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const videoAR = vw / vh;
  const targetAR = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (videoAR > targetAR) {
    sh = vh; sw = vh * targetAR; sx = (vw - sw) / 2; sy = 0;
  } else {
    sw = vw; sh = vw / targetAR; sx = 0; sy = (vh - sh) / 2;
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
}

// ── Banner rendering ──

interface BannerImages {
  poster: HTMLImageElement | null;
  cast: (HTMLImageElement | null)[];
  logo: HTMLImageElement | null;
}

function renderStaticBanner(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  images: BannerImages,
  title: string,
  type: string,
  year: string,
  duration: string | null,
  synopsis: string,
  castNames: string[],
) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, H);

  if (images.poster) {
    ctx.globalAlpha = 0.12;
    ctx.drawImage(images.poster, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(17,17,17,0.88)";
    ctx.fillRect(0, 0, W, H);
  }

  // Poster
  const posterW = 130, posterH = 195;
  if (images.poster) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 20;
    drawRoundedRect(ctx, 20, 20, posterW, posterH, 8);
    ctx.clip();
    ctx.drawImage(images.poster, 20, 20, posterW, posterH);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 20, 20, posterW, posterH, 8);
    ctx.stroke();
  }

  const textX = 170;

  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title.toUpperCase(), textX, 48, W - textX - 20);

  // Badges
  const badges = [type, year, duration].filter(Boolean) as string[];
  let bx = textX;
  ctx.font = "bold 13px sans-serif";
  badges.forEach((badge) => {
    const bw = ctx.measureText(badge).width + 16;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    drawRoundedRect(ctx, bx, 58, bw, 24, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, bx, 58, bw, 24, 4);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillText(badge, bx + 8, 74);
    bx += bw + 8;
  });

  // Synopsis
  if (synopsis) {
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const words = synopsis.split(" ");
    let line = "";
    let ly = 106;
    let lc = 0;
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > W - textX - 30) {
        if (++lc > 3) break;
        ctx.fillText(line.trim(), textX, ly);
        line = w + " ";
        ly += 19;
      } else {
        line = test;
      }
    }
    if (lc <= 3 && line.trim()) ctx.fillText(line.trim(), textX, ly);
  }

  // Cast
  if (castNames.length > 0) {
    const castY = 180;
    let cx = textX;
    castNames.slice(0, 5).forEach((name, i) => {
      const cImg = images.cast[i];
      const sz = 44;
      if (cImg) {
        drawCircularImage(ctx, cImg, cx, castY, sz);
        ctx.beginPath();
        ctx.arc(cx + sz / 2, castY + sz / 2, sz / 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx + 22, castY + 22, 22, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(name[0], cx + 22, castY + 28);
        ctx.textAlign = "left";
      }
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "center";
      ctx.fillText(name.split(" ")[0], cx + 22, castY + 58, 54);
      ctx.textAlign = "left";
      cx += 64;
    });
  }

  // Logo
  if (images.logo) {
    const lh = 40;
    const lw = (images.logo.width / images.logo.height) * lh;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(images.logo, W - lw - 20, H - lh - 15, lw, lh);
    ctx.globalAlpha = 1;
  }
}

// ── Trailer download ──

async function downloadTrailer(videoId: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-video-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ videoId }),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

// ── Video loading ──

function loadVideoFromBlob(blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(blob);
    video.oncanplaythrough = () => resolve(video);
    video.onerror = () => reject(new Error("Falha ao carregar trailer"));
    video.load();
  });
}

// ── MP4 generation with real trailer ──

async function generateMP4(
  trailerBlob: Blob,
  bannerImages: BannerImages,
  selected: ContentDetails,
  title: string,
  type: string,
  year: string,
  duration: string | null,
  onStatus: (s: string) => void,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

  const WIDTH = 1080;
  const VIDEO_H = 608;
  const BANNER_H = 320;
  const HEIGHT = VIDEO_H + BANNER_H;
  const FPS = 24;
  const MAX_DURATION = 15;
  const FRAME_DURATION_US = Math.round(1_000_000 / FPS);

  onStatus("Carregando trailer...");
  const video = await loadVideoFromBlob(trailerBlob);
  const videoDuration = Math.min(video.duration || 10, MAX_DURATION);
  const totalFrames = Math.ceil(videoDuration * FPS);

  // Pre-render static banner
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = WIDTH;
  bannerCanvas.height = BANNER_H;
  renderStaticBanner(
    bannerCanvas.getContext("2d")!,
    WIDTH, BANNER_H, bannerImages,
    title, type, year, duration,
    selected.overview || "",
    selected.cast.map((c) => c.name),
  );

  // Main canvas
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Find supported codec
  const codecs = ["avc1.42001f", "avc1.4d001f", "avc1.640029"];
  let selectedCodec = "";
  for (const c of codecs) {
    const s = await VideoEncoder.isConfigSupported({
      codec: c,
      width: WIDTH,
      height: HEIGHT,
      bitrate: 4_000_000,
      framerate: FPS,
    });
    if (s.supported) {
      selectedCodec = c;
      break;
    }
  }
  if (!selectedCodec) {
    throw new Error("Navegador não suporta codificação H.264. Use o Google Chrome.");
  }

  // Setup muxer + encoder
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: WIDTH, height: HEIGHT },
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata) =>
      muxer.addVideoChunk(chunk, meta),
    error: (e: DOMException) => console.error("Encoder error:", e),
  });

  encoder.configure({
    codec: selectedCodec,
    width: WIDTH,
    height: HEIGHT,
    bitrate: 4_000_000,
    framerate: FPS,
    latencyMode: "quality",
  });

  onStatus("Renderizando vídeo...");

  // Encode frames by seeking through the trailer
  for (let i = 0; i < totalFrames; i++) {
    const seekTime = Math.min((i / FPS), videoDuration - 0.05);

    // Seek to target time
    await new Promise<void>((resolve) => {
      const handler = () => resolve();
      if (Math.abs(video.currentTime - seekTime) < 0.03) {
        resolve();
        return;
      }
      video.onseeked = handler;
      video.currentTime = seekTime;
    });

    // Wait for frame to be decoded
    await new Promise((r) => setTimeout(r, 30));

    // Draw trailer video on top
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, VIDEO_H);
    drawVideoCover(ctx, video, WIDTH, VIDEO_H);

    // Draw static banner on bottom
    ctx.drawImage(bannerCanvas, 0, VIDEO_H);

    // Use strictly monotonic timestamps
    const timestamp = i * FRAME_DURATION_US;

    const frame = new VideoFrame(canvas, {
      timestamp,
      duration: FRAME_DURATION_US,
    });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();

    onProgress(25 + Math.round((i / totalFrames) * 65));
  }

  onStatus("Finalizando MP4...");
  await encoder.flush();
  encoder.close();
  muxer.finalize();

  URL.revokeObjectURL(video.src);

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 1000) {
    throw new Error("MP4 gerado está vazio ou corrompido");
  }

  return new Blob([buffer], { type: "video/mp4" });
}

// ── Fallback: WebM with backdrop animation ──

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

async function generateFallbackWebM(
  bannerImages: BannerImages,
  selected: ContentDetails,
  title: string,
  type: string,
  year: string,
  duration: string | null,
  backdropImg: HTMLImageElement | null,
  onStatus: (s: string) => void,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const WIDTH = 1080;
  const VIDEO_H = 608;
  const BANNER_H = 320;
  const HEIGHT = VIDEO_H + BANNER_H;
  const FPS = 24;
  const DURATION_S = 8;
  const TOTAL_FRAMES = FPS * DURATION_S;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Pre-render banner
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = WIDTH;
  bannerCanvas.height = BANNER_H;
  renderStaticBanner(
    bannerCanvas.getContext("2d")!,
    WIDTH, BANNER_H, bannerImages,
    title, type, year, duration,
    selected.overview || "",
    selected.cast.map((c) => c.name),
  );

  // Render first frame
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (backdropImg) ctx.drawImage(backdropImg, 0, 0, WIDTH, VIDEO_H);
  ctx.drawImage(bannerCanvas, 0, VIDEO_H);

  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  if (!mimeType) throw new Error("Navegador não suporta gravação de vídeo");

  const stream = canvas.captureStream(FPS);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  onStatus("Gravando vídeo...");
  recorder.start();

  let frameIndex = 0;
  await new Promise<void>((resolve) => {
    const interval = 1000 / FPS;
    let lastTime = performance.now();
    function tick() {
      const now = performance.now();
      if (now - lastTime >= interval) {
        const t = frameIndex / TOTAL_FRAMES;
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // Ken Burns on backdrop
        if (backdropImg) {
          const fadeIn = easeOut(clamp(t / 0.08, 0, 1));
          ctx.globalAlpha = fadeIn;
          const scale = 1.0 + 0.15 * t;
          const sw = WIDTH * scale;
          const sh = VIDEO_H * scale;
          ctx.drawImage(backdropImg, (WIDTH - sw) / 2 - 25 * t, (VIDEO_H - sh) / 2 - 12 * t, sw, sh);
          ctx.globalAlpha = 1;
          const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
          grad.addColorStop(0, "rgba(0,0,0,0.35)");
          grad.addColorStop(1, "rgba(0,0,0,0.75)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        }

        // Title overlay
        const titleT = easeOut(clamp((t - 0.08) / 0.18, 0, 1));
        if (titleT > 0) {
          ctx.globalAlpha = titleT;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 44px sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 12;
          ctx.fillText(title.toUpperCase(), WIDTH / 2, VIDEO_H / 2 - 20 + 35 * (1 - titleT), WIDTH - 80);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.textAlign = "left";
        }

        // Banner
        ctx.drawImage(bannerCanvas, 0, VIDEO_H);

        frameIndex++;
        lastTime = now;
        onProgress(25 + Math.round((frameIndex / TOTAL_FRAMES) * 65));
        if (frameIndex > TOTAL_FRAMES) { resolve(); return; }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });
  await new Promise((r) => setTimeout(r, 200));

  if (chunks.length === 0) throw new Error("Nenhum dado capturado");
  return new Blob(chunks, { type: mimeType });
}

// ── Component ──

export function VideoBannerPreview({ selected, logoUrl, onBack }: Props) {
  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const duration = selected.runtime
    ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min`
    : null;
  const trailer =
    selected.videos.find((v) => v.type === "Trailer") || selected.videos[0];

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    setProgress(0);

    try {
      // Load banner images
      setStatusText("Carregando imagens...");
      const posterUrl = selected.poster_path
        ? `${TMDB_IMG}/w342${selected.poster_path}`
        : null;
      const backdropUrl = selected.backdrop_path
        ? `${TMDB_IMG}/w1280${selected.backdrop_path}`
        : null;

      const imgPromises: Promise<HTMLImageElement | null>[] = [];
      imgPromises.push(
        posterUrl ? loadImageViaProxy(posterUrl).catch(() => null) : Promise.resolve(null)
      );
      for (const c of selected.cast.slice(0, 5)) {
        imgPromises.push(
          c.profile_path
            ? loadImageViaProxy(`${TMDB_IMG}/w185${c.profile_path}`).catch(() => null)
            : Promise.resolve(null)
        );
      }
      if (logoUrl) {
        imgPromises.push(loadImageViaProxy(logoUrl).catch(() => null));
      }
      imgPromises.push(
        backdropUrl ? loadImageViaProxy(backdropUrl).catch(() => null) : Promise.resolve(null)
      );

      const allImgs = await Promise.all(imgPromises);
      const castCount = Math.min(selected.cast.length, 5);
      const bannerImages: BannerImages = {
        poster: allImgs[0],
        cast: allImgs.slice(1, 1 + castCount),
        logo: logoUrl ? allImgs[1 + castCount] : null,
      };
      const backdropImg = allImgs[allImgs.length - 1];
      setProgress(15);

      const slug = title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const hasWebCodecs = typeof VideoEncoder !== "undefined";

      let downloaded = false;

      // Try MP4 with real trailer
      if (trailer && hasWebCodecs) {
        setStatusText("Baixando trailer...");
        const trailerBlob = await downloadTrailer(trailer.key);
        setProgress(25);

        if (trailerBlob && trailerBlob.size > 10_000) {
          try {
            const mp4 = await generateMP4(
              trailerBlob,
              bannerImages,
              selected,
              title,
              type,
              year,
              duration,
              setStatusText,
              setProgress,
            );

            const url = URL.createObjectURL(mp4);
            const a = document.createElement("a");
            a.href = url;
            a.download = `video-banner-${slug}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            downloaded = true;
          } catch (e) {
            console.warn("MP4 generation failed, falling back:", e);
          }
        }
      }

      // Fallback: WebM with backdrop animation
      if (!downloaded) {
        setStatusText("Gerando vídeo alternativo...");
        setProgress(25);
        const webm = await generateFallbackWebM(
          bannerImages,
          selected,
          title,
          type,
          year,
          duration,
          backdropImg,
          setStatusText,
          setProgress,
        );

        const url = URL.createObjectURL(webm);
        const a = document.createElement("a");
        a.href = url;
        a.download = `video-banner-${slug}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }

      setProgress(100);
      toast({ title: "Vídeo banner gerado com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao gerar vídeo:", err);
      toast({
        title: "Erro ao gerar vídeo",
        description: err?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setStatusText("");
      setTimeout(() => setProgress(0), 1000);
    }
  }, [selected, logoUrl, title, year, type, duration, trailer]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg overflow-hidden border">
            {/* TOP: YouTube Trailer */}
            {trailer ? (
              <div className="aspect-video bg-black relative overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3&disablekb=1&fs=0`}
                  className="w-full h-full pointer-events-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen={false}
                  title="Trailer"
                  style={{ border: "none" }}
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground">
                <p>Trailer não encontrado para este título</p>
              </div>
            )}

            {/* BOTTOM: Banner */}
            <div className="relative bg-zinc-900 p-4">
              {selected.poster_path && (
                <img
                  src={`${TMDB_IMG}/w342${selected.poster_path}`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-15"
                />
              )}
              <div className="relative z-10 flex gap-4">
                {selected.poster_path && (
                  <img
                    src={`${TMDB_IMG}/w342${selected.poster_path}`}
                    alt={title}
                    className="w-24 rounded border border-white/20 shadow-lg shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-sm uppercase">{title}</h3>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">
                      {type}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">
                      {year}
                    </span>
                    {duration && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">
                        {duration}
                      </span>
                    )}
                  </div>
                  {selected.overview && (
                    <p className="text-[10px] text-white/80 mt-2 line-clamp-3">
                      {selected.overview}
                    </p>
                  )}
                </div>
              </div>
              {selected.cast.length > 0 && (
                <div className="relative z-10 flex gap-3 mt-3 pt-3 border-t border-white/10">
                  {selected.cast.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex flex-col items-center w-10">
                      {c.profile_path ? (
                        <img
                          src={`${TMDB_IMG}/w185${c.profile_path}`}
                          alt={c.name}
                          className="h-10 w-10 rounded-full object-cover border border-white/30"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xs text-white font-bold">
                          {c.name[0]}
                        </div>
                      )}
                      <span className="text-[8px] mt-0.5 text-white/70 truncate w-full text-center">
                        {c.name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {logoUrl && (
                <div className="relative z-10 flex justify-end mt-3">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-8 w-auto object-contain opacity-80"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Download */}
          <Button
            onClick={handleDownload}
            disabled={generating}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {statusText || "Gerando..."} {progress > 0 && `${progress}%`}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar Video Banner (MP4)
              </>
            )}
          </Button>
          {generating && <Progress value={progress} className="h-2" />}
        </CardContent>
      </Card>
    </div>
  );
}
