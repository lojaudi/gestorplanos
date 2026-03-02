import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Info } from "lucide-react";
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

// ── Animation helpers ──

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ── MP4 generation with backdrop Ken Burns ──

async function generateMP4WithBackdrop(
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
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

  const WIDTH = 1080;
  const VIDEO_H = 608;
  const BANNER_H = 320;
  const HEIGHT = VIDEO_H + BANNER_H;
  const FPS = 24;
  const DURATION_S = 10;
  const TOTAL_FRAMES = FPS * DURATION_S;
  const FRAME_DURATION_US = Math.round(1_000_000 / FPS);

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

  // Find supported H.264 codec
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

  // Encode in small batches and flush periodically to avoid memory crash
  const BATCH = FPS; // flush every 1 second of video (24 frames)

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const t = i / TOTAL_FRAMES;

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

    // Title overlay with animation
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

    // Static banner at bottom
    ctx.drawImage(bannerCanvas, 0, VIDEO_H);

    const timestamp = i * FRAME_DURATION_US;
    const frame = new VideoFrame(canvas, {
      timestamp,
      duration: FRAME_DURATION_US,
    });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();

    onProgress(20 + Math.round((i / TOTAL_FRAMES) * 70));

    // Flush encoder every BATCH frames to free memory
    if ((i + 1) % BATCH === 0) {
      await encoder.flush();
      // Yield to UI
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onStatus("Finalizando MP4...");
  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 1000) {
    throw new Error("MP4 gerado está vazio ou corrompido");
  }

  return new Blob([buffer], { type: "video/mp4" });
}

// ── Animated Preview Canvas ──

function AnimatedPreview({ selected, logoUrl }: { selected: ContentDetails; logoUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const imagesRef = useRef<{
    backdrop: HTMLImageElement | null;
    poster: HTMLImageElement | null;
    cast: (HTMLImageElement | null)[];
    logo: HTMLImageElement | null;
  }>({ backdrop: null, poster: null, cast: [], logo: null });
  const [loaded, setLoaded] = useState(false);

  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const duration = selected.runtime
    ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min`
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const posterUrl = selected.poster_path ? `${TMDB_IMG}/w342${selected.poster_path}` : null;
      const backdropUrl = selected.backdrop_path ? `${TMDB_IMG}/w1280${selected.backdrop_path}` : null;

      // Load images directly (for preview, CORS doesn't matter since we don't export)
      const loadImg = (url: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });

      const [backdrop, poster] = await Promise.all([
        backdropUrl ? loadImg(backdropUrl) : Promise.resolve(null),
        posterUrl ? loadImg(posterUrl) : Promise.resolve(null),
      ]);

      const castImgs = await Promise.all(
        selected.cast.slice(0, 5).map((c) =>
          c.profile_path ? loadImg(`${TMDB_IMG}/w185${c.profile_path}`) : Promise.resolve(null)
        )
      );

      const logo = logoUrl ? await loadImg(logoUrl) : null;

      if (!cancelled) {
        imagesRef.current = { backdrop, poster, cast: castImgs, logo };
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, logoUrl]);

  useEffect(() => {
    if (!loaded || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = 1080;
    const VIDEO_H = 608;
    const BANNER_H = 320;
    const H = VIDEO_H + BANNER_H;
    canvas.width = W;
    canvas.height = H;

    // Pre-render static banner
    const bannerCanvas = document.createElement("canvas");
    bannerCanvas.width = W;
    bannerCanvas.height = BANNER_H;
    renderStaticBanner(
      bannerCanvas.getContext("2d")!,
      W, BANNER_H,
      { poster: imagesRef.current.poster, cast: imagesRef.current.cast, logo: imagesRef.current.logo },
      title, type, year, duration,
      selected.overview || "",
      selected.cast.map((c) => c.name),
    );

    const LOOP_S = 10;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const t = (elapsed % LOOP_S) / LOOP_S;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      // Ken Burns on backdrop
      const { backdrop } = imagesRef.current;
      if (backdrop) {
        const fadeIn = easeOut(clamp(t / 0.08, 0, 1));
        ctx.globalAlpha = fadeIn;
        const scale = 1.0 + 0.15 * t;
        const sw = W * scale;
        const sh = VIDEO_H * scale;
        ctx.drawImage(backdrop, (W - sw) / 2 - 25 * t, (VIDEO_H - sh) / 2 - 12 * t, sw, sh);
        ctx.globalAlpha = 1;
        const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
        grad.addColorStop(0, "rgba(0,0,0,0.35)");
        grad.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, VIDEO_H);
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
        ctx.fillText(title.toUpperCase(), W / 2, VIDEO_H / 2 - 20 + 35 * (1 - titleT), W - 80);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }

      // Static banner at bottom
      ctx.drawImage(bannerCanvas, 0, VIDEO_H);

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [loaded, title, type, year, duration, selected]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg"
      style={{ aspectRatio: "1080 / 928" }}
    />
  );
}

// ── Component ──

export function VideoBannerPreview({ selected, logoUrl, onBack }: Props) {
  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const duration = selected.runtime
    ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min`
    : null;

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    setProgress(0);

    try {
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

      if (typeof VideoEncoder === "undefined") {
        throw new Error("Seu navegador não suporta WebCodecs. Use o Google Chrome.");
      }

      setStatusText("Gerando vídeo...");
      const finalBlob = await generateMP4WithBackdrop(
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

      if (!finalBlob || finalBlob.size < 1000) {
        throw new Error("Falha ao gerar o vídeo banner.");
      }

      const slug = title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      console.log("[VideoBanner] MP4 generated:", finalBlob.size, "bytes");
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
  }, [selected, logoUrl, title, year, type, duration]);

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
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              A prévia abaixo mostra exatamente como o vídeo será gerado: animação na imagem de
              fundo com informações do título. O arquivo MP4 terá 10 segundos de duração.
            </p>
          </div>

          {/* Animated canvas preview */}
          <div className="rounded-lg overflow-hidden border">
            <AnimatedPreview selected={selected} logoUrl={logoUrl} />
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
