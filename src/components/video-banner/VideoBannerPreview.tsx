import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ContentDetails } from "@/pages/VideoBanner";

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface Props {
  selected: ContentDetails;
  logoUrl: string | null;
  onBack: () => void;
}

// ---------- helpers ----------
async function loadImageAsDataUrl(url: string): Promise<string> {
  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
  });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedImage(
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

  // ---------- Download handler ----------
  const handleDownload = useCallback(async () => {
    setGenerating(true);
    setProgress(0);

    try {
      const WIDTH = 1080;
      const VIDEO_H = 607; // 16:9 top
      const BANNER_H = 320;
      const HEIGHT = VIDEO_H + BANNER_H;
      const FPS = 30;
      const DURATION = 8; // seconds
      const TOTAL_FRAMES = FPS * DURATION;

      // Load images
      setProgress(5);
      const backdropUrl = selected.backdrop_path
        ? `${TMDB_IMG}/w1280${selected.backdrop_path}`
        : null;
      const posterUrl = selected.poster_path
        ? `${TMDB_IMG}/w342${selected.poster_path}`
        : null;

      const [backdropDataUrl, posterDataUrl] = await Promise.all([
        backdropUrl ? loadImageAsDataUrl(backdropUrl) : Promise.resolve(null),
        posterUrl ? loadImageAsDataUrl(posterUrl) : Promise.resolve(null),
      ]);

      setProgress(15);

      const backdropImg = backdropDataUrl ? await loadImage(backdropDataUrl) : null;
      const posterImg = posterDataUrl ? await loadImage(posterDataUrl) : null;

      // Load cast images
      const castImages: (HTMLImageElement | null)[] = [];
      for (const c of selected.cast.slice(0, 5)) {
        if (c.profile_path) {
          try {
            const du = await loadImageAsDataUrl(`${TMDB_IMG}/w185${c.profile_path}`);
            castImages.push(await loadImage(du));
          } catch {
            castImages.push(null);
          }
        } else {
          castImages.push(null);
        }
      }

      // Load logo
      let logoImg: HTMLImageElement | null = null;
      if (logoUrl) {
        try {
          const du = await loadImageAsDataUrl(logoUrl);
          logoImg = await loadImage(du);
        } catch {
          logoImg = null;
        }
      }

      setProgress(30);

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d")!;

      // MediaRecorder
      const stream = canvas.captureStream(FPS);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 5_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const renderFrame = (frame: number) => {
        const t = frame / TOTAL_FRAMES;

        // --- Top: Backdrop with Ken Burns ---
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
          // Darken overlay
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        }

        // Title overlay on video section
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(title.toUpperCase(), WIDTH / 2, VIDEO_H / 2 - 20, WIDTH - 80);

        // Genres under title
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

        // --- Bottom: Banner ---
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, VIDEO_H, WIDTH, BANNER_H);
        ctx.clip();

        // Background
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
          const pw = 130;
          const ph = 195;
          ctx.drawImage(posterImg, 20, bY, pw, ph);
        }

        // Title
        const textX = 170;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(title.toUpperCase(), textX, bY + 28, WIDTH - textX - 20);

        // Badges
        let badgeX = textX;
        const badges = [type, year, duration].filter(Boolean) as string[];
        ctx.font = "bold 13px sans-serif";
        for (const badge of badges) {
          const bw = ctx.measureText(badge).width + 16;
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.beginPath();
          ctx.roundRect(badgeX, bY + 38, bw, 22, 4);
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
          const maxLines = 3;
          let lineCount = 0;
          for (const word of words) {
            const test = line + word + " ";
            if (ctx.measureText(test).width > WIDTH - textX - 30) {
              lineCount++;
              if (lineCount > maxLines) break;
              ctx.fillText(line.trim(), textX, ly);
              line = word + " ";
              ly += 18;
            } else {
              line = test;
            }
          }
          if (lineCount <= maxLines && line.trim()) {
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
              drawRoundedImage(ctx, cImg, cx, castY, circleSize);
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

      // Record
      recorder.start();
      for (let i = 0; i <= TOTAL_FRAMES; i++) {
        renderFrame(i);
        setProgress(30 + Math.round((i / TOTAL_FRAMES) * 65));
        await new Promise((r) => setTimeout(r, 1000 / FPS));
      }

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      setProgress(98);

      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-banner-${title.replace(/\s+/g, "-").toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setProgress(100);
      toast({ title: "Vídeo banner gerado com sucesso!" });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar vídeo",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setProgress(0);
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
          {/* Video Banner Composition */}
          <div className="rounded-lg overflow-hidden border">
            {/* TOP: YouTube Trailer Embed — no branding/controls */}
            {trailer ? (
              <div className="aspect-video bg-black">
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

            {/* BOTTOM: Banner Section */}
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

          {/* Download button */}
          <Button
            onClick={handleDownload}
            disabled={generating}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando vídeo...
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
