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
  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy`;
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("Proxy error");
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
  x: number, y: number, w: number, h: number, r: number
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

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function getBestMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
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
      const FPS = 24;
      const DURATION_S = 8;
      const TOTAL_FRAMES = FPS * DURATION_S;

      // Load images
      const backdropUrl = selected.backdrop_path
        ? `${TMDB_IMG}/w1280${selected.backdrop_path}`
        : null;
      const posterUrl = selected.poster_path
        ? `${TMDB_IMG}/w342${selected.poster_path}`
        : null;

      const promises: Promise<HTMLImageElement | null>[] = [];
      promises.push(backdropUrl ? loadImageViaProxy(backdropUrl).catch(() => null) : Promise.resolve(null));
      promises.push(posterUrl ? loadImageViaProxy(posterUrl).catch(() => null) : Promise.resolve(null));
      for (const c of selected.cast.slice(0, 5)) {
        promises.push(
          c.profile_path
            ? loadImageViaProxy(`${TMDB_IMG}/w185${c.profile_path}`).catch(() => null)
            : Promise.resolve(null)
        );
      }
      if (logoUrl) promises.push(loadImageViaProxy(logoUrl).catch(() => null));

      const allImages = await Promise.all(promises);
      const backdropImg = allImages[0];
      const posterImg = allImages[1];
      const castImages = allImages.slice(2, 2 + Math.min(selected.cast.length, 5));
      const logoImg = logoUrl ? allImages[allImages.length - 1] : null;

      setProgress(20);
      setStatusText("Preparando gravação...");

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d")!;
      if (!ctx) throw new Error("Canvas não suportado");

      // Pre-render first frame so canvas has content before recording starts
      renderFrame(0);

      const mimeType = getBestMimeType();
      if (!mimeType) throw new Error("Seu navegador não suporta gravação de vídeo. Tente o Google Chrome.");

      const stream = canvas.captureStream(FPS);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      function renderFrame(frame: number) {
        const t = frame / TOTAL_FRAMES;

        // Background
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // === TOP: Backdrop with Ken Burns ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, WIDTH, VIDEO_H);
        ctx.clip();

        const fadeIn = easeOut(clamp(t / 0.08, 0, 1));

        if (backdropImg) {
          ctx.globalAlpha = fadeIn;
          const scale = 1.0 + 0.15 * t;
          const panX = -25 * t;
          const panY = -12 * t;
          const sw = WIDTH * scale;
          const sh = VIDEO_H * scale;
          ctx.drawImage(
            backdropImg,
            (WIDTH - sw) / 2 + panX,
            (VIDEO_H - sh) / 2 + panY,
            sw,
            sh
          );
          ctx.globalAlpha = 1;

          // Dark overlay
          const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
          grad.addColorStop(0, "rgba(0,0,0,0.35)");
          grad.addColorStop(0.5, "rgba(0,0,0,0.2)");
          grad.addColorStop(1, "rgba(0,0,0,0.75)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        }

        // Title
        const titleT = easeOut(clamp((t - 0.08) / 0.18, 0, 1));
        if (titleT > 0) {
          ctx.globalAlpha = titleT;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 44px sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 12;
          const titleY = VIDEO_H / 2 - 20 + 35 * (1 - titleT);
          ctx.fillText(title.toUpperCase(), WIDTH / 2, titleY, WIDTH - 80);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }

        // Genres
        if (selected.genres?.length) {
          const gT = easeOut(clamp((t - 0.18) / 0.14, 0, 1));
          if (gT > 0) {
            ctx.globalAlpha = gT * 0.85;
            ctx.font = "22px sans-serif";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText(
              selected.genres.map((g) => g.name).join("  •  "),
              WIDTH / 2,
              VIDEO_H / 2 + 18 + 18 * (1 - gT),
              WIDTH - 80
            );
            ctx.globalAlpha = 1;
          }
        }

        // Play icon
        const playT = easeOut(clamp((t - 0.22) / 0.14, 0, 1));
        if (playT > 0) {
          const pulse = 1 + 0.06 * Math.sin(t * Math.PI * 5);
          const r = 30 * playT * pulse;
          ctx.globalAlpha = playT * 0.9;
          ctx.beginPath();
          ctx.arc(WIDTH / 2, VIDEO_H / 2 + 70, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.lineWidth = 2;
          ctx.stroke();
          const s = 12 * playT;
          ctx.beginPath();
          ctx.moveTo(WIDTH / 2 - s * 0.6, VIDEO_H / 2 + 70 - s);
          ctx.lineTo(WIDTH / 2 - s * 0.6, VIDEO_H / 2 + 70 + s);
          ctx.lineTo(WIDTH / 2 + s, VIDEO_H / 2 + 70);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();

        // === BOTTOM: Banner ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, VIDEO_H, WIDTH, BANNER_H);
        ctx.clip();

        const bannerT = easeOut(clamp((t - 0.28) / 0.18, 0, 1));
        const bannerOffY = BANNER_H * 0.25 * (1 - bannerT);

        if (bannerT > 0) {
          ctx.globalAlpha = bannerT;

          // BG
          if (posterImg) {
            ctx.drawImage(posterImg, 0, VIDEO_H + bannerOffY, WIDTH, BANNER_H);
            ctx.fillStyle = "rgba(10,10,10,0.92)";
            ctx.fillRect(0, VIDEO_H + bannerOffY, WIDTH, BANNER_H);
          } else {
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(0, VIDEO_H + bannerOffY, WIDTH, BANNER_H);
          }

          const bY = VIDEO_H + 20 + bannerOffY;

          // Poster
          const pT = easeOut(clamp((t - 0.38) / 0.14, 0, 1));
          if (posterImg && pT > 0) {
            ctx.globalAlpha = bannerT * pT;
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 18;
            ctx.drawImage(posterImg, -130 + 150 * pT, bY, 130, 195);
            ctx.restore();
            ctx.globalAlpha = bannerT;
          }

          const textX = 170;

          // Title in banner
          const btT = easeOut(clamp((t - 0.42) / 0.1, 0, 1));
          if (btT > 0) {
            ctx.globalAlpha = bannerT * btT;
            ctx.fillStyle = "#fff";
            ctx.font = "bold 26px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(title.toUpperCase(), textX, bY + 28, WIDTH - textX - 20);
            ctx.globalAlpha = bannerT;
          }

          // Badges
          const badges = [type, year, duration].filter(Boolean) as string[];
          let bx = textX;
          ctx.font = "bold 13px sans-serif";
          badges.forEach((badge, i) => {
            const badgeT2 = easeOut(clamp((t - 0.48 - i * 0.03) / 0.08, 0, 1));
            if (badgeT2 > 0) {
              const bw = ctx.measureText(badge).width + 16;
              ctx.globalAlpha = bannerT * badgeT2;
              ctx.fillStyle = "rgba(255,255,255,0.12)";
              drawRoundedRect(ctx, bx, bY + 38, bw, 24, 4);
              ctx.fill();
              ctx.strokeStyle = "rgba(255,255,255,0.2)";
              ctx.lineWidth = 1;
              drawRoundedRect(ctx, bx, bY + 38, bw, 24, 4);
              ctx.stroke();
              ctx.fillStyle = "#fff";
              ctx.fillText(badge, bx + 8, bY + 54);
              bx += bw + 8;
              ctx.globalAlpha = bannerT;
            }
          });

          // Synopsis
          if (selected.overview) {
            const sT = clamp((t - 0.52) / 0.18, 0, 1);
            if (sT > 0) {
              ctx.font = "14px sans-serif";
              ctx.fillStyle = "rgba(255,255,255,0.8)";
              ctx.textAlign = "left";
              ctx.globalAlpha = bannerT * Math.min(sT * 2.5, 1);
              const visibleChars = Math.floor(200 * easeOut(sT));
              const text = selected.overview.substring(0, visibleChars);
              const words = text.split(" ");
              let line = "";
              let ly = bY + 82;
              let lc = 0;
              for (const w of words) {
                const test = line + w + " ";
                if (ctx.measureText(test).width > WIDTH - textX - 30) {
                  if (++lc > 3) break;
                  ctx.fillText(line.trim(), textX, ly);
                  line = w + " ";
                  ly += 19;
                } else {
                  line = test;
                }
              }
              if (lc <= 3 && line.trim()) ctx.fillText(line.trim(), textX, ly);
              ctx.globalAlpha = bannerT;
            }
          }

          // Cast
          if (selected.cast.length > 0) {
            const castY = bY + 155;
            let cx = textX;
            selected.cast.slice(0, 5).forEach((c, i) => {
              const cT = easeOut(clamp((t - 0.62 - i * 0.03) / 0.08, 0, 1));
              if (cT > 0) {
                const cImg = castImages[i];
                const sz = 44 * cT;
                const cxOff = cx + (44 - sz) / 2;
                const cyOff = castY + (44 - sz) / 2;
                ctx.globalAlpha = bannerT * cT;
                if (cImg) {
                  drawCircularImage(ctx, cImg, cxOff, cyOff, sz);
                  ctx.beginPath();
                  ctx.arc(cxOff + sz / 2, cyOff + sz / 2, sz / 2, 0, Math.PI * 2);
                  ctx.strokeStyle = "rgba(255,255,255,0.3)";
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                } else {
                  ctx.beginPath();
                  ctx.arc(cx + 22, castY + 22, sz / 2, 0, Math.PI * 2);
                  ctx.fillStyle = "rgba(255,255,255,0.15)";
                  ctx.fill();
                  if (cT > 0.5) {
                    ctx.fillStyle = "#fff";
                    ctx.font = "bold 16px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(c.name[0], cx + 22, castY + 28);
                    ctx.textAlign = "left";
                  }
                }
                if (cT > 0.6) {
                  ctx.font = "10px sans-serif";
                  ctx.fillStyle = "rgba(255,255,255,0.6)";
                  ctx.textAlign = "center";
                  ctx.fillText(c.name.split(" ")[0], cx + 22, castY + 58, 54);
                  ctx.textAlign = "left";
                }
                ctx.globalAlpha = bannerT;
              }
              cx += 64;
            });
          }

          // Logo
          if (logoImg) {
            const lT = easeOut(clamp((t - 0.78) / 0.12, 0, 1));
            if (lT > 0) {
              const lh = 40;
              const lw = (logoImg.width / logoImg.height) * lh;
              ctx.globalAlpha = bannerT * lT * 0.85;
              ctx.drawImage(logoImg, WIDTH - lw - 20, VIDEO_H + BANNER_H - lh - 15 + bannerOffY, lw, lh);
            }
          }

          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }

      // Start recording
      setStatusText("Gravando vídeo...");
      recorder.start();

      // Render frames using requestAnimationFrame for smoother output
      let frameIndex = 0;
      await new Promise<void>((resolve, reject) => {
        const interval = 1000 / FPS;
        let lastTime = performance.now();

        function tick() {
          const now = performance.now();
          if (now - lastTime >= interval) {
            renderFrame(frameIndex);
            frameIndex++;
            lastTime = now;
            setProgress(20 + Math.round((frameIndex / TOTAL_FRAMES) * 65));

            if (frameIndex > TOTAL_FRAMES) {
              resolve();
              return;
            }
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });

      // Stop and collect
      setStatusText("Finalizando...");
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      // Small delay to ensure all data is flushed
      await new Promise((r) => setTimeout(r, 200));

      if (chunks.length === 0) throw new Error("Nenhum dado de vídeo foi capturado");

      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < 1000) throw new Error("Vídeo gerado está vazio ou corrompido");

      setProgress(95);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-banner-${title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

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
