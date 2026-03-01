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

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

async function convertToMp4(webmBlob: Blob, onProgress: (p: number) => void): Promise<Blob> {
  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();
    
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });

    await ffmpeg.load();
    
    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile("input.webm", inputData);
    
    await ffmpeg.exec([
      "-i", "input.webm",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "output.mp4"
    ]);
    
    const data = await ffmpeg.readFile("output.mp4");
    const arrayBuffer = (data as Uint8Array).slice().buffer as ArrayBuffer;
    return new Blob([arrayBuffer], { type: "video/mp4" });
  } catch (err) {
    console.warn("FFmpeg conversion failed, falling back to webm:", err);
    throw err;
  }
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
  const [statusText, setStatusText] = useState("");

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    setProgress(0);
    setStatusText("Carregando imagens...");

    try {
      const WIDTH = 1080;
      const VIDEO_H = 607;
      const BANNER_H = 320;
      const HEIGHT = VIDEO_H + BANNER_H;
      const FPS = 30;
      const DURATION = 10;
      const TOTAL_FRAMES = FPS * DURATION;

      setProgress(5);

      // Load images via proxy
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

      for (const c of selected.cast.slice(0, 5)) {
        if (c.profile_path) {
          imagePromises.push(
            loadImageViaProxy(`${TMDB_IMG}/w185${c.profile_path}`).catch(() => null)
          );
        } else {
          imagePromises.push(Promise.resolve(null));
        }
      }

      if (logoUrl) {
        imagePromises.push(loadImageViaProxy(logoUrl).catch(() => null));
      }

      const allImages = await Promise.all(imagePromises);

      const backdropImg = allImages[0];
      const posterImg = allImages[1];
      const castImages = allImages.slice(2, 2 + Math.min(selected.cast.length, 5));
      const logoImg = logoUrl ? allImages[allImages.length - 1] : null;

      setProgress(25);
      setStatusText("Gerando animação...");

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
        videoBitsPerSecond: 6_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Animation timeline (normalized 0-1)
      // 0.0 - 0.1: Fade in backdrop
      // 0.1 - 1.0: Ken Burns zoom + pan
      // 0.1 - 0.3: Title slides up & fades in
      // 0.2 - 0.4: Genres fade in
      // 0.25 - 0.4: Play icon pulses in
      // 0.3 - 0.5: Banner section slides up
      // 0.4 - 0.6: Poster slides in from left
      // 0.45 - 0.6: Title in banner fades in
      // 0.5 - 0.65: Badges appear one by one
      // 0.55 - 0.7: Synopsis types in
      // 0.65 - 0.85: Cast members appear one by one
      // 0.8 - 0.95: Logo fades in

      const renderFrame = (frame: number) => {
        const t = frame / TOTAL_FRAMES;

        // Clear
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // === TOP SECTION: Backdrop with Ken Burns ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, WIDTH, VIDEO_H);
        ctx.clip();

        // Fade in backdrop
        const backdropAlpha = clamp((t - 0) / 0.1, 0, 1);

        if (backdropImg && backdropAlpha > 0) {
          ctx.globalAlpha = easeOut(backdropAlpha);
          // Ken Burns: slow zoom + slight horizontal pan
          const kbT = clamp((t - 0.05) / 0.95, 0, 1);
          const scale = 1.0 + 0.2 * kbT;
          const panX = -30 * kbT;
          const panY = -15 * kbT;
          const sw = WIDTH * scale;
          const sh = VIDEO_H * scale;
          const sx = (WIDTH - sw) / 2 + panX;
          const sy = (VIDEO_H - sh) / 2 + panY;
          ctx.drawImage(backdropImg, sx, sy, sw, sh);
          ctx.globalAlpha = 1;

          // Dark overlay with gradient
          const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
          grad.addColorStop(0, "rgba(0,0,0,0.3)");
          grad.addColorStop(0.5, "rgba(0,0,0,0.2)");
          grad.addColorStop(1, "rgba(0,0,0,0.7)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        }

        // Title animation: slides up + fades in
        const titleT = easeOut(clamp((t - 0.1) / 0.2, 0, 1));
        if (titleT > 0) {
          const titleY = VIDEO_H / 2 - 20 + 40 * (1 - titleT);
          ctx.globalAlpha = titleT;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 44px sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 15;
          ctx.fillText(title.toUpperCase(), WIDTH / 2, titleY, WIDTH - 80);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }

        // Genres fade in
        if (selected.genres && selected.genres.length > 0) {
          const genreT = easeOut(clamp((t - 0.2) / 0.15, 0, 1));
          if (genreT > 0) {
            ctx.globalAlpha = genreT * 0.8;
            ctx.font = "22px sans-serif";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText(
              selected.genres.map((g) => g.name).join("  •  "),
              WIDTH / 2,
              VIDEO_H / 2 + 20 + 20 * (1 - genreT),
              WIDTH - 80
            );
            ctx.globalAlpha = 1;
          }
        }

        // Play icon with pulse animation
        const playT = easeOut(clamp((t - 0.25) / 0.15, 0, 1));
        if (playT > 0) {
          const pulseScale = 1 + 0.08 * Math.sin(t * Math.PI * 6);
          const playRadius = 32 * playT * pulseScale;
          ctx.globalAlpha = playT * 0.9;

          // Outer glow
          ctx.beginPath();
          ctx.arc(WIDTH / 2, VIDEO_H / 2 + 75, playRadius + 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fill();

          // Circle
          ctx.beginPath();
          ctx.arc(WIDTH / 2, VIDEO_H / 2 + 75, playRadius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Triangle
          const triSize = 14 * playT;
          ctx.beginPath();
          ctx.moveTo(WIDTH / 2 - triSize * 0.7, VIDEO_H / 2 + 75 - triSize);
          ctx.lineTo(WIDTH / 2 - triSize * 0.7, VIDEO_H / 2 + 75 + triSize);
          ctx.lineTo(WIDTH / 2 + triSize, VIDEO_H / 2 + 75);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();

        // === BOTTOM SECTION: Info Banner ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, VIDEO_H, WIDTH, BANNER_H);
        ctx.clip();

        // Banner slides up
        const bannerSlideT = easeOut(clamp((t - 0.3) / 0.2, 0, 1));
        const bannerOffsetY = BANNER_H * 0.3 * (1 - bannerSlideT);

        if (bannerSlideT > 0) {
          ctx.globalAlpha = bannerSlideT;

          // Background with blurred poster
          if (posterImg) {
            ctx.drawImage(posterImg, 0, VIDEO_H + bannerOffsetY, WIDTH, BANNER_H);
            ctx.fillStyle = "rgba(10,10,10,0.9)";
            ctx.fillRect(0, VIDEO_H + bannerOffsetY, WIDTH, BANNER_H);
          } else {
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(0, VIDEO_H + bannerOffsetY, WIDTH, BANNER_H);
          }

          // Subtle gradient overlay
          const bannerGrad = ctx.createLinearGradient(0, VIDEO_H, 0, VIDEO_H + BANNER_H);
          bannerGrad.addColorStop(0, "rgba(20,20,20,0.5)");
          bannerGrad.addColorStop(1, "rgba(10,10,10,0.3)");
          ctx.fillStyle = bannerGrad;
          ctx.fillRect(0, VIDEO_H + bannerOffsetY, WIDTH, BANNER_H);

          const bY = VIDEO_H + 20 + bannerOffsetY;

          // Poster slides in from left
          const posterT = easeOut(clamp((t - 0.4) / 0.15, 0, 1));
          if (posterImg && posterT > 0) {
            const posterX = -130 + 150 * posterT;
            ctx.globalAlpha = bannerSlideT * posterT;
            ctx.save();
            // Add shadow to poster
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 5;
            ctx.drawImage(posterImg, posterX, bY, 130, 195);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.restore();
            ctx.globalAlpha = bannerSlideT;
          }

          const textX = 170;

          // Banner title fades in
          const bTitleT = easeOut(clamp((t - 0.45) / 0.12, 0, 1));
          if (bTitleT > 0) {
            ctx.globalAlpha = bannerSlideT * bTitleT;
            ctx.fillStyle = "#fff";
            ctx.font = "bold 26px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(title.toUpperCase(), textX, bY + 28 + 10 * (1 - bTitleT), WIDTH - textX - 20);
            ctx.globalAlpha = bannerSlideT;
          }

          // Badges appear one by one
          const badges = [type, year, duration].filter(Boolean) as string[];
          let badgeX = textX;
          ctx.font = "bold 13px sans-serif";
          badges.forEach((badge, i) => {
            const badgeT = easeOut(clamp((t - 0.5 - i * 0.04) / 0.1, 0, 1));
            if (badgeT > 0) {
              const bw = ctx.measureText(badge).width + 16;
              ctx.globalAlpha = bannerSlideT * badgeT;
              
              // Badge background with slight color
              ctx.fillStyle = "rgba(255,255,255,0.12)";
              drawRoundedRect(ctx, badgeX, bY + 38, bw * badgeT, 24, 4);
              ctx.fill();
              
              // Badge border
              ctx.strokeStyle = "rgba(255,255,255,0.2)";
              ctx.lineWidth = 1;
              drawRoundedRect(ctx, badgeX, bY + 38, bw * badgeT, 24, 4);
              ctx.stroke();
              
              if (badgeT > 0.5) {
                ctx.fillStyle = "#fff";
                ctx.globalAlpha = bannerSlideT * clamp((badgeT - 0.5) * 2, 0, 1);
                ctx.fillText(badge, badgeX + 8, bY + 54);
              }
              badgeX += bw + 8;
              ctx.globalAlpha = bannerSlideT;
            }
          });

          // Synopsis with typewriter effect
          if (selected.overview) {
            const synopsisT = clamp((t - 0.55) / 0.2, 0, 1);
            if (synopsisT > 0) {
              ctx.font = "14px sans-serif";
              ctx.fillStyle = "rgba(255,255,255,0.8)";
              ctx.textAlign = "left";

              const fullText = selected.overview;
              const maxChars = 200;
              const visibleText = fullText.substring(0, Math.floor(maxChars * easeOut(synopsisT)));
              
              const words = visibleText.split(" ");
              let line = "";
              let ly = bY + 82;
              let lineCount = 0;
              ctx.globalAlpha = bannerSlideT * Math.min(synopsisT * 3, 1);
              for (const word of words) {
                const test = line + word + " ";
                if (ctx.measureText(test).width > WIDTH - textX - 30) {
                  lineCount++;
                  if (lineCount > 3) break;
                  ctx.fillText(line.trim(), textX, ly);
                  line = word + " ";
                  ly += 19;
                } else {
                  line = test;
                }
              }
              if (lineCount <= 3 && line.trim()) {
                ctx.fillText(line.trim(), textX, ly);
              }
              ctx.globalAlpha = bannerSlideT;
            }
          }

          // Cast members appear one by one with scale animation
          if (selected.cast.length > 0) {
            const castY = bY + 155;
            let cx = textX;
            selected.cast.slice(0, 5).forEach((c, i) => {
              const castMemberT = easeOut(clamp((t - 0.65 - i * 0.04) / 0.1, 0, 1));
              if (castMemberT > 0) {
                const cImg = castImages[i];
                const circleSize = 44 * castMemberT;
                const circleX = cx + (44 - circleSize) / 2;
                const circleY = castY + (44 - circleSize) / 2;

                ctx.globalAlpha = bannerSlideT * castMemberT;

                if (cImg) {
                  drawCircularImage(ctx, cImg, circleX, circleY, circleSize);
                  // Border
                  ctx.beginPath();
                  ctx.arc(circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2, 0, Math.PI * 2);
                  ctx.strokeStyle = "rgba(255,255,255,0.3)";
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                } else {
                  ctx.beginPath();
                  ctx.arc(cx + 22, castY + 22, circleSize / 2, 0, Math.PI * 2);
                  ctx.fillStyle = "rgba(255,255,255,0.15)";
                  ctx.fill();
                  ctx.strokeStyle = "rgba(255,255,255,0.2)";
                  ctx.lineWidth = 1;
                  ctx.stroke();
                  if (castMemberT > 0.5) {
                    ctx.fillStyle = "#fff";
                    ctx.font = "bold 16px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(c.name[0], cx + 22, castY + 28);
                    ctx.textAlign = "left";
                  }
                }

                // Name below
                if (castMemberT > 0.6) {
                  ctx.font = "10px sans-serif";
                  ctx.fillStyle = "rgba(255,255,255,0.6)";
                  ctx.textAlign = "center";
                  ctx.globalAlpha = bannerSlideT * clamp((castMemberT - 0.6) * 2.5, 0, 1);
                  ctx.fillText(c.name.split(" ")[0], cx + 22, castY + 58, 54);
                  ctx.textAlign = "left";
                }

                ctx.globalAlpha = bannerSlideT;
              }
              cx += 64;
            });
          }

          // Logo fades in
          if (logoImg) {
            const logoT = easeOut(clamp((t - 0.8) / 0.15, 0, 1));
            if (logoT > 0) {
              const lh = 40;
              const lw = (logoImg.width / logoImg.height) * lh;
              ctx.globalAlpha = bannerSlideT * logoT * 0.85;
              ctx.drawImage(logoImg, WIDTH - lw - 20, VIDEO_H + BANNER_H - lh - 15 + bannerOffsetY, lw, lh);
            }
          }

          ctx.globalAlpha = 1;
        }

        ctx.restore();
      };

      // Record frames
      recorder.start(100);
      setStatusText("Renderizando frames...");

      for (let i = 0; i <= TOTAL_FRAMES; i++) {
        renderFrame(i);
        if (i % 10 === 0) {
          setProgress(25 + Math.round((i / TOTAL_FRAMES) * 45));
        }
        await new Promise((r) => setTimeout(r, 1000 / FPS));
      }

      // Stop and wait for final data
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      setProgress(72);

      if (chunks.length === 0) {
        throw new Error("Nenhum dado de vídeo foi gerado");
      }

      const webmBlob = new Blob(chunks, { type: mimeType });

      // Convert to MP4
      let finalBlob: Blob;
      let extension: string;

      setStatusText("Convertendo para MP4...");
      try {
        finalBlob = await convertToMp4(webmBlob, (p) => {
          setProgress(72 + Math.round(p * 0.25));
        });
        extension = "mp4";
      } catch {
        // Fallback to webm if conversion fails
        finalBlob = webmBlob;
        extension = mimeType.includes("mp4") ? "mp4" : "webm";
        toast({ title: "Conversão MP4 indisponível, baixando em WebM" });
      }

      setProgress(98);
      setStatusText("Baixando...");

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-banner-${title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      toast({ title: `Vídeo banner gerado em ${extension.toUpperCase()} com sucesso!` });
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
