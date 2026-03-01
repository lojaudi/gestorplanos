import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import type { ContentDetails } from "@/pages/VideoBanner";

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface Props {
  selected: ContentDetails;
  logoUrl: string | null;
  onBack: () => void;
}

// ---------- helpers ----------
async function loadImageViaProxy(url: string): Promise<HTMLImageElement> {
  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
  });
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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

function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

// ---------- component ----------
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

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    setProgress(0);

    try {
      const WIDTH = 1080;
      const VIDEO_H = 607;
      const BANNER_H = 320;
      const HEIGHT = VIDEO_H + BANNER_H;
      const FPS = 24;
      const DURATION = 8;
      const TOTAL_FRAMES = FPS * DURATION;

      setProgress(5);

      // Load images via proxy (parallel where possible)
      const backdropUrl = selected.backdrop_path
        ? `${TMDB_IMG}/w1280${selected.backdrop_path}`
        : null;
      const posterUrl = selected.poster_path
        ? `${TMDB_IMG}/w342${selected.poster_path}`
        : null;

      const imagePromises: Promise<HTMLImageElement | null>[] = [];

      imagePromises.push(
        backdropUrl ? loadImageViaProxy(backdropUrl).catch(() => null) : Promise.resolve(null)
      );
      imagePromises.push(
        posterUrl ? loadImageViaProxy(posterUrl).catch(() => null) : Promise.resolve(null)
      );

      // Cast images
      for (const c of selected.cast.slice(0, 5)) {
        if (c.profile_path) {
          imagePromises.push(
            loadImageViaProxy(`${TMDB_IMG}/w185${c.profile_path}`).catch(() => null)
          );
        } else {
          imagePromises.push(Promise.resolve(null));
        }
      }

      // Logo
      if (logoUrl) {
        imagePromises.push(loadImageViaProxy(logoUrl).catch(() => null));
      }

      const allImages = await Promise.all(imagePromises);

      const backdropImg = allImages[0];
      const posterImg = allImages[1];
      const castImages = allImages.slice(2, 2 + Math.min(selected.cast.length, 5));
      const logoImg = logoUrl ? allImages[allImages.length - 1] : null;

      setProgress(30);

      // Canvas setup
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado");

      // MediaRecorder setup
      const mimeType = getSupportedMimeType();
      const stream = canvas.captureStream(FPS);
      const chunks: Blob[] = [];

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const renderFrame = (frame: number) => {
        const t = frame / TOTAL_FRAMES;

        // === TOP: Backdrop with Ken Burns ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, WIDTH, VIDEO_H);
        ctx.clip();

        if (backdropImg) {
          const scale = 1 + 0.15 * t;
          const sw = WIDTH * scale;
          const sh = VIDEO_H * scale;
          const sx = (WIDTH - sw) / 2;
          const sy = (VIDEO_H - sh) / 2;
          ctx.drawImage(backdropImg, sx, sy, sw, sh);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        }

        // Title
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(title.toUpperCase(), WIDTH / 2, VIDEO_H / 2 - 20, WIDTH - 80);

        // Genres
        if (selected.genres && selected.genres.length > 0) {
          ctx.font = "22px sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillText(
            selected.genres.map((g) => g.name).join(" • "),
            WIDTH / 2,
            VIDEO_H / 2 + 20,
            WIDTH - 80
          );
        }

        // Play icon
        ctx.beginPath();
        ctx.arc(WIDTH / 2, VIDEO_H / 2 + 70, 30, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2 - 10, VIDEO_H / 2 + 55);
        ctx.lineTo(WIDTH / 2 - 10, VIDEO_H / 2 + 85);
        ctx.lineTo(WIDTH / 2 + 18, VIDEO_H / 2 + 70);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();

        ctx.restore();

        // === BOTTOM: Banner ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, VIDEO_H, WIDTH, BANNER_H);
        ctx.clip();

        if (posterImg) {
          ctx.drawImage(posterImg, 0, VIDEO_H, WIDTH, BANNER_H);
          ctx.fillStyle = "rgba(17,17,17,0.88)";
          ctx.fillRect(0, VIDEO_H, WIDTH, BANNER_H);
        } else {
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(0, VIDEO_H, WIDTH, BANNER_H);
        }

        const bY = VIDEO_H + 20;

        // Poster
        if (posterImg) {
          ctx.drawImage(posterImg, 20, bY, 130, 195);
        }

        // Title
        const textX = 170;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(title.toUpperCase(), textX, bY + 28, WIDTH - textX - 20);

        // Badges (using custom rounded rect instead of roundRect)
        let badgeX = textX;
        const badges = [type, year, duration].filter(Boolean) as string[];
        ctx.font = "bold 13px sans-serif";
        for (const badge of badges) {
          const bw = ctx.measureText(badge).width + 16;
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          drawRoundedRect(ctx, badgeX, bY + 38, bw, 22, 4);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText(badge, badgeX + 8, bY + 53);
          badgeX += bw + 8;
        }

        // Synopsis
        if (selected.overview) {
          ctx.font = "13px sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          const words = selected.overview.split(" ");
          let line = "";
          let ly = bY + 82;
          let lineCount = 0;
          for (const word of words) {
            const test = line + word + " ";
            if (ctx.measureText(test).width > WIDTH - textX - 30) {
              lineCount++;
              if (lineCount > 3) break;
              ctx.fillText(line.trim(), textX, ly);
              line = word + " ";
              ly += 18;
            } else {
              line = test;
            }
          }
          if (lineCount <= 3 && line.trim()) {
            ctx.fillText(line.trim(), textX, ly);
          }
        }

        // Cast
        if (selected.cast.length > 0) {
          const castY = bY + 155;
          let cx = textX;
          selected.cast.slice(0, 5).forEach((c, i) => {
            const cImg = castImages[i];
            const circleSize = 44;
            if (cImg) {
              drawCircularImage(ctx, cImg, cx, castY, circleSize);
            } else {
              ctx.beginPath();
              ctx.arc(cx + circleSize / 2, castY + circleSize / 2, circleSize / 2, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(255,255,255,0.2)";
              ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.font = "bold 16px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText(c.name[0], cx + circleSize / 2, castY + circleSize / 2 + 6);
              ctx.textAlign = "left";
            }
            ctx.font = "10px sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.textAlign = "center";
            ctx.fillText(c.name.split(" ")[0], cx + circleSize / 2, castY + circleSize + 14, circleSize + 10);
            ctx.textAlign = "left";
            cx += circleSize + 20;
          });
        }

        // Logo
        if (logoImg) {
          const lh = 40;
          const lw = (logoImg.width / logoImg.height) * lh;
          ctx.globalAlpha = 0.8;
          ctx.drawImage(logoImg, WIDTH - lw - 20, VIDEO_H + BANNER_H - lh - 15, lw, lh);
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      };

      // Record frames
      recorder.start(100); // request data every 100ms

      for (let i = 0; i <= TOTAL_FRAMES; i++) {
        renderFrame(i);
        setProgress(30 + Math.round((i / TOTAL_FRAMES) * 60));
        await new Promise((r) => setTimeout(r, 1000 / FPS));
      }

      // Stop and wait for final data
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      setProgress(95);

      if (chunks.length === 0) {
        throw new Error("Nenhum dado de vídeo foi gerado");
      }

      const blob = new Blob(chunks, { type: mimeType });
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-banner-${title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
          <div className="rounded-lg overflow-hidden border">
            {/* TOP: YouTube Trailer — no branding/controls */}
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
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{type}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{year}</span>
                    {duration && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{duration}</span>
                    )}
                  </div>
                  {selected.overview && (
                    <p className="text-[10px] text-white/80 mt-2 line-clamp-3">{selected.overview}</p>
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
                  <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain opacity-80" />
                </div>
              )}
            </div>
          </div>

          {/* Download */}
          <Button onClick={handleDownload} disabled={generating} className="w-full" size="lg">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando vídeo... {progress > 0 && `${progress}%`}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar Video Banner
              </>
            )}
          </Button>
          {generating && <Progress value={progress} className="h-2" />}
        </CardContent>
      </Card>
    </div>
  );
}
