import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// ── Banner rendering ──

interface BannerImages {
  poster: HTMLImageElement | null;
  cast: (HTMLImageElement | null)[];
  logo: HTMLImageElement | null;
}

function renderStaticBanner(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  images: BannerImages,
  title: string, type: string, year: string, duration: string | null,
  synopsis: string, castNames: string[],
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
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title.toUpperCase(), textX, 48, W - textX - 20);

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

  if (images.logo) {
    const lh = 40;
    const lw = (images.logo.width / images.logo.height) * lh;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(images.logo, W - lw - 20, H - lh - 15, lw, lh);
    ctx.globalAlpha = 1;
  }
}

// ── Helpers ──

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ── Shared encoder setup ──

async function setupEncoder(WIDTH: number, HEIGHT: number, FPS: number) {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

  const codecs = ["avc1.42001f", "avc1.4d001f", "avc1.640029"];
  let selectedCodec = "";
  for (const c of codecs) {
    const s = await VideoEncoder.isConfigSupported({
      codec: c, width: WIDTH, height: HEIGHT, bitrate: 4_000_000, framerate: FPS,
    });
    if (s.supported) { selectedCodec = c; break; }
  }
  if (!selectedCodec) throw new Error("Navegador não suporta codificação H.264. Use o Google Chrome.");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, video: { codec: "avc", width: WIDTH, height: HEIGHT }, fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata) => muxer.addVideoChunk(chunk, meta),
    error: (e: DOMException) => console.error("Encoder error:", e),
  });
  encoder.configure({
    codec: selectedCodec, width: WIDTH, height: HEIGHT,
    bitrate: 4_000_000, framerate: FPS, latencyMode: "quality",
  });

  return { encoder, muxer, target };
}

async function waitForEncoder(encoder: VideoEncoder) {
  while (encoder.encodeQueueSize > 3) {
    await new Promise(r => setTimeout(r, 10));
  }
}

// ── MP4 generation with trailer video ──

async function generateMP4WithTrailer(
  trailerBlob: Blob,
  maxDurationS: number,
  bannerImages: BannerImages,
  selected: ContentDetails,
  title: string, type: string, year: string, duration: string | null,
  onStatus: (s: string) => void,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const WIDTH = 1080;
  const VIDEO_H = 608;
  const BANNER_H = 320;
  const HEIGHT = VIDEO_H + BANNER_H;
  const FPS = 15;
  const FRAME_DURATION_US = Math.round(1_000_000 / FPS);

  // Pre-render banner
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = WIDTH;
  bannerCanvas.height = BANNER_H;
  renderStaticBanner(
    bannerCanvas.getContext("2d")!, WIDTH, BANNER_H, bannerImages,
    title, type, year, duration,
    selected.overview || "", selected.cast.map(c => c.name),
  );

  // Load video element
  onStatus("Carregando trailer...");
  const videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = "auto";
  const blobUrl = URL.createObjectURL(trailerBlob);
  videoEl.src = blobUrl;

  await new Promise<void>((resolve, reject) => {
    videoEl.onloadeddata = () => resolve();
    videoEl.onerror = () => reject(new Error("Erro ao decodificar trailer"));
    setTimeout(() => reject(new Error("Timeout ao carregar trailer")), 20000);
  });

  const clipDuration = Math.min(videoEl.duration, maxDurationS);
  const totalFrames = Math.ceil(clipDuration * FPS);

  onStatus(`Processando ${Math.round(clipDuration)}s de trailer (${totalFrames} frames)...`);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const { encoder, muxer, target } = await setupEncoder(WIDTH, HEIGHT, FPS);

  // Seek-based frame capture with aggressive timeouts
  // Each frame seek has a hard timeout - if it hangs, we skip and move on
  for (let i = 0; i < totalFrames; i++) {
    const targetTime = Math.min(i / FPS, clipDuration - 0.01);

    // Seek with hard timeout - skip frame if it hangs
    const seekOk = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 800);
      const handler = () => {
        clearTimeout(timeout);
        videoEl.removeEventListener("seeked", handler);
        resolve(true);
      };
      videoEl.addEventListener("seeked", handler);
      videoEl.currentTime = targetTime;
    });

    if (!seekOk) {
      // Skip this frame but don't give up
      console.warn(`[video-banner] Seek timeout at frame ${i}, skipping`);
      continue;
    }

    // Draw trailer frame in top portion
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(videoEl, 0, 0, WIDTH, VIDEO_H);

    // Draw banner at bottom
    ctx.drawImage(bannerCanvas, 0, VIDEO_H);

    const timestamp = i * FRAME_DURATION_US;
    const frame = new VideoFrame(canvas, { timestamp, duration: FRAME_DURATION_US });

    await waitForEncoder(encoder);
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();

    onProgress(20 + Math.round((i / totalFrames) * 70));

    // Flush & yield every 10 frames to keep UI responsive
    if ((i + 1) % 10 === 0) {
      await encoder.flush();
      await new Promise(r => setTimeout(r, 0));
    }
  }

  onStatus("Finalizando MP4...");
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  URL.revokeObjectURL(blobUrl);

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 1000) throw new Error("MP4 gerado está vazio");
  return new Blob([buffer], { type: "video/mp4" });
}

// ── MP4 generation with Ken Burns fallback ──

async function generateMP4KenBurns(
  bannerImages: BannerImages,
  selected: ContentDetails,
  title: string, type: string, year: string, duration: string | null,
  backdropImg: HTMLImageElement | null,
  durationS: number,
  onStatus: (s: string) => void,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const WIDTH = 1080;
  const VIDEO_H = 608;
  const BANNER_H = 320;
  const HEIGHT = VIDEO_H + BANNER_H;
  const FPS = 24;
  const TOTAL_FRAMES = FPS * durationS;
  const FRAME_DURATION_US = Math.round(1_000_000 / FPS);

  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = WIDTH;
  bannerCanvas.height = BANNER_H;
  renderStaticBanner(
    bannerCanvas.getContext("2d")!, WIDTH, BANNER_H, bannerImages,
    title, type, year, duration,
    selected.overview || "", selected.cast.map(c => c.name),
  );

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const { encoder, muxer, target } = await setupEncoder(WIDTH, HEIGHT, FPS);

  onStatus("Renderizando vídeo...");

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const t = i / TOTAL_FRAMES;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

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

    ctx.drawImage(bannerCanvas, 0, VIDEO_H);

    const timestamp = i * FRAME_DURATION_US;
    const frame = new VideoFrame(canvas, { timestamp, duration: FRAME_DURATION_US });

    await waitForEncoder(encoder);
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();

    onProgress(20 + Math.round((i / TOTAL_FRAMES) * 70));

    if ((i + 1) % FPS === 0) {
      await encoder.flush();
      await new Promise(r => setTimeout(r, 0));
    }
  }

  onStatus("Finalizando MP4...");
  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 1000) throw new Error("MP4 gerado está vazio");
  return new Blob([buffer], { type: "video/mp4" });
}

// ── Component ──

export function VideoBannerPreview({ selected, logoUrl, onBack }: Props) {
  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const duration = selected.runtime
    ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min`
    : null;
  const trailer = selected.videos.find((v) => v.type === "Trailer") || selected.videos[0];

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [trailerDuration, setTrailerDuration] = useState("30");

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    setProgress(0);

    try {
      // Load banner images
      setStatusText("Carregando imagens...");
      const posterUrl = selected.poster_path ? `${TMDB_IMG}/w342${selected.poster_path}` : null;
      const backdropUrl = selected.backdrop_path ? `${TMDB_IMG}/w1280${selected.backdrop_path}` : null;

      const imgPromises: Promise<HTMLImageElement | null>[] = [];
      imgPromises.push(posterUrl ? loadImageViaProxy(posterUrl).catch(() => null) : Promise.resolve(null));
      for (const c of selected.cast.slice(0, 5)) {
        imgPromises.push(
          c.profile_path ? loadImageViaProxy(`${TMDB_IMG}/w185${c.profile_path}`).catch(() => null) : Promise.resolve(null)
        );
      }
      if (logoUrl) imgPromises.push(loadImageViaProxy(logoUrl).catch(() => null));
      imgPromises.push(backdropUrl ? loadImageViaProxy(backdropUrl).catch(() => null) : Promise.resolve(null));

      const allImgs = await Promise.all(imgPromises);
      const castCount = Math.min(selected.cast.length, 5);
      const bannerImages: BannerImages = {
        poster: allImgs[0],
        cast: allImgs.slice(1, 1 + castCount),
        logo: logoUrl ? allImgs[1 + castCount] : null,
      };
      const backdropImg = allImgs[allImgs.length - 1];
      setProgress(10);

      if (typeof VideoEncoder === "undefined") {
        throw new Error("Seu navegador não suporta WebCodecs. Use o Google Chrome.");
      }

      const maxDuration = Number(trailerDuration);
      let finalBlob: Blob | null = null;

      // Try downloading trailer via Cobalt proxy
      if (trailer) {
        try {
          setStatusText("Baixando trailer do YouTube...");
          setProgress(12);
          const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-video-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
            body: JSON.stringify({ videoId: trailer.key }),
            signal: AbortSignal.timeout(90000),
          });

          if (res.ok) {
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("video")) {
              const trailerBlob = await res.blob();
              setProgress(20);
              if (trailerBlob.size > 10000) {
                console.log(`[video-banner] Trailer downloaded: ${(trailerBlob.size / 1024 / 1024).toFixed(1)}MB`);
                finalBlob = await generateMP4WithTrailer(
                  trailerBlob, maxDuration, bannerImages, selected,
                  title, type, year, duration, setStatusText, setProgress,
                );
              }
            }
          }
        } catch (err) {
          console.warn("[video-banner] Trailer download failed, using Ken Burns:", err);
        }
      }

      // Fallback: Ken Burns on backdrop
      if (!finalBlob) {
        setStatusText("Gerando vídeo com animação cinematográfica...");
        setProgress(20);
        finalBlob = await generateMP4KenBurns(
          bannerImages, selected, title, type, year, duration,
          backdropImg, Math.min(maxDuration, 15), setStatusText, setProgress,
        );
      }

      if (!finalBlob || finalBlob.size < 1000) throw new Error("Falha ao gerar o vídeo banner.");

      const slug = title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-banner-${slug}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setProgress(100);
      toast({ title: "Vídeo banner MP4 gerado com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao gerar vídeo:", err);
      toast({ title: "Erro ao gerar vídeo", description: err?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setGenerating(false);
      setStatusText("");
      setTimeout(() => setProgress(0), 1000);
    }
  }, [selected, logoUrl, title, year, type, duration, trailer, trailerDuration]);

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
          {/* YouTube Trailer + Banner Preview */}
          <div className="rounded-lg overflow-hidden border">
            {trailer ? (
              <div className="aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0&controls=1&modestbranding=1&showinfo=0`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Trailer"
                  style={{ border: "none" }}
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground">
                <p>Trailer não encontrado para este título</p>
              </div>
            )}
            {/* Banner info */}
            <div className="relative bg-zinc-900 p-4">
              {selected.poster_path && (
                <img src={`${TMDB_IMG}/w342${selected.poster_path}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
              )}
              <div className="relative z-10 flex gap-4">
                {selected.poster_path && (
                  <img src={`${TMDB_IMG}/w342${selected.poster_path}`} alt={title} className="w-24 rounded border border-white/20 shadow-lg shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-sm uppercase">{title}</h3>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{type}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{year}</span>
                    {duration && <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{duration}</span>}
                  </div>
                  {selected.overview && <p className="text-[10px] text-white/80 mt-2 line-clamp-3">{selected.overview}</p>}
                </div>
              </div>
              {selected.cast.length > 0 && (
                <div className="relative z-10 flex gap-3 mt-3 pt-3 border-t border-white/10">
                  {selected.cast.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex flex-col items-center w-10">
                      {c.profile_path ? (
                        <img src={`${TMDB_IMG}/w185${c.profile_path}`} alt={c.name} className="h-10 w-10 rounded-full object-cover border border-white/30" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xs text-white font-bold">{c.name[0]}</div>
                      )}
                      <span className="text-[8px] mt-0.5 text-white/70 truncate w-full text-center">{c.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}
              {logoUrl && (
                <div className="relative z-10 flex justify-end mt-3">
                  <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain opacity-80" />
                </div>
              )}
            </div>
          </div>

          {/* Duration selector + Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Duração do trailer:</span>
            </div>
            <Select value={trailerDuration} onValueChange={setTrailerDuration}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 segundos</SelectItem>
                <SelectItem value="15">15 segundos</SelectItem>
                <SelectItem value="30">30 segundos</SelectItem>
                <SelectItem value="45">45 segundos</SelectItem>
                <SelectItem value="60">60 segundos</SelectItem>
                <SelectItem value="90">90 segundos</SelectItem>
                <SelectItem value="120">120 segundos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {trailer
                ? "O trailer será baixado e combinado com o banner no MP4 final."
                : "Sem trailer — será usado efeito cinematográfico no backdrop."}
            </p>
          </div>

          {/* Download button + progress */}
          <Button
            onClick={handleDownload}
            disabled={generating}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {statusText || "Gerando..."}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Baixar Video Banner MP4
              </>
            )}
          </Button>

          {generating && progress > 0 && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
