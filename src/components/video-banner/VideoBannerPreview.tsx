import { useRef, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Loader2, Play } from "lucide-react";
import type { ContentDetails } from "@/pages/VideoBanner";

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface Props {
  selected: ContentDetails;
  logoUrl: string | null;
  onBack: () => void;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  // Proxy external images through edge function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let finalSrc = src;
  if (!src.startsWith("data:") && !src.startsWith("blob:")) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/image-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseKey },
        body: JSON.stringify({ url: src }),
      });
      if (res.ok) {
        const blob = await res.blob();
        finalSrc = URL.createObjectURL(blob);
      }
    } catch { /* use original */ }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = finalSrc;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    if (ctx.measureText(testLine).width > maxWidth && line !== "") {
      lineCount++;
      if (lineCount > maxLines) break;
      ctx.fillText(line.trim(), x, y);
      y += lineHeight;
      line = words[i] + " ";
    } else {
      line = testLine;
    }
  }
  if (lineCount <= maxLines) {
    ctx.fillText(line.trim(), x, y);
  }
  return y + lineHeight;
}

export function VideoBannerPreview({ selected, logoUrl, onBack }: Props) {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const duration = selected.runtime ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min` : null;

  // Find best trailer
  const trailer = selected.videos.find(v => v.type === "Trailer") || selected.videos[0];

  const generateVideo = useCallback(async () => {
    setGenerating(true);
    setPreviewUrl(null);
    try {
      const W = 1080;
      const VIDEO_H = 608; // 16:9 top section
      const BANNER_H = 608; // bottom banner
      const H = VIDEO_H + BANNER_H;
      const FPS = 30;
      const DURATION = 8; // seconds

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Load images
      const backdropSrc = selected.backdrop_path
        ? `${TMDB_IMG}/w1280${selected.backdrop_path}`
        : selected.poster_path
          ? `${TMDB_IMG}/w780${selected.poster_path}`
          : null;

      const posterSrc = selected.poster_path ? `${TMDB_IMG}/w500${selected.poster_path}` : null;

      let backdropImg: HTMLImageElement | null = null;
      let posterImg: HTMLImageElement | null = null;
      let logoImg: HTMLImageElement | null = null;
      const castImgs: (HTMLImageElement | null)[] = [];

      toast({ title: "Carregando imagens..." });

      const promises: Promise<any>[] = [];
      if (backdropSrc) promises.push(loadImage(backdropSrc).then(i => { backdropImg = i; }).catch(() => {}));
      if (posterSrc) promises.push(loadImage(posterSrc).then(i => { posterImg = i; }).catch(() => {}));
      if (logoUrl) promises.push(loadImage(logoUrl).then(i => { logoImg = i; }).catch(() => {}));

      for (const c of selected.cast.slice(0, 5)) {
        if (c.profile_path) {
          promises.push(
            loadImage(`${TMDB_IMG}/w185${c.profile_path}`)
              .then(i => castImgs.push(i))
              .catch(() => castImgs.push(null))
          );
        } else {
          castImgs.push(null);
        }
      }

      await Promise.all(promises);

      toast({ title: "Gerando vídeo... aguarde" });

      // Setup MediaRecorder
      const stream = canvas.captureStream(FPS);
      const chunks: Blob[] = [];

      // Try different codecs
      let mimeType = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const totalFrames = FPS * DURATION;

      const renderFrame = (frameIndex: number) => {
        const progress = frameIndex / totalFrames;
        ctx.clearRect(0, 0, W, H);

        // === TOP: Backdrop with Ken Burns effect ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, VIDEO_H);
        ctx.clip();

        if (backdropImg) {
          const scale = 1.0 + progress * 0.15; // slow zoom
          const panX = progress * 30;
          const imgW = W * scale;
          const imgH = (backdropImg.height / backdropImg.width) * imgW;
          const x = -panX;
          const y = (VIDEO_H - imgH) / 2;
          ctx.drawImage(backdropImg, x, y, imgW, imgH);
        } else {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(0, 0, W, VIDEO_H);
        }

        // Dark gradient overlay on video section
        const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
        grad.addColorStop(0, "rgba(0,0,0,0.3)");
        grad.addColorStop(0.7, "rgba(0,0,0,0.1)");
        grad.addColorStop(1, "rgba(0,0,0,0.6)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, VIDEO_H);

        // Logo on top-right of video section
        if (logoImg) {
          const lh = 80;
          const lw = (logoImg.width / logoImg.height) * lh;
          ctx.drawImage(logoImg, W - lw - 30, 25, lw, lh);
        }

        // Title overlay on video section (fade in)
        const titleAlpha = Math.min(1, progress * 4);
        ctx.globalAlpha = titleAlpha;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px Arial, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 12;
        ctx.fillText(title.toUpperCase(), 40, VIDEO_H - 40);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.restore();

        // === BOTTOM: Banner section ===
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, VIDEO_H, W, BANNER_H);
        ctx.clip();

        // Banner background: poster blurred (simulated with dark overlay)
        if (posterImg) {
          const pw = W;
          const ph = (posterImg.height / posterImg.width) * pw;
          ctx.drawImage(posterImg, 0, VIDEO_H, pw, ph);
          // Dark overlay for readability
          ctx.fillStyle = "rgba(0,0,0,0.75)";
          ctx.fillRect(0, VIDEO_H, W, BANNER_H);
        } else {
          ctx.fillStyle = "#0d0d0d";
          ctx.fillRect(0, VIDEO_H, W, BANNER_H);
        }

        const BY = VIDEO_H + 30; // banner Y start

        // Poster thumbnail
        const posterW = 200;
        const posterH = 300;
        if (posterImg) {
          ctx.drawImage(posterImg, 30, BY, posterW, posterH);
          // Border
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 2;
          ctx.strokeRect(30, BY, posterW, posterH);
        }

        // Text info
        const textX = posterImg ? 260 : 40;
        let textY = BY + 10;

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px Arial, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 6;
        textY = wrapText(ctx, title.toUpperCase(), textX, textY + 30, W - textX - 40, 42, 2);
        ctx.shadowBlur = 0;

        // Type + Year + Duration badges
        textY += 8;
        const badges = [type, year];
        if (duration) badges.push(duration);
        let bx = textX;
        ctx.font = "bold 20px Arial, sans-serif";
        for (const badge of badges) {
          const bw = ctx.measureText(badge).width + 24;
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(bx, textY - 18, bw, 30);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(badge, bx + 12, textY + 4);
          bx += bw + 10;
        }
        textY += 30;

        // Synopsis
        if (selected.overview) {
          textY += 10;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 16px Arial, sans-serif";
          ctx.fillText("Sinopse:", textX, textY);
          textY += 6;
          ctx.font = "14px Arial, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          textY = wrapText(ctx, selected.overview, textX, textY + 16, W - textX - 40, 20, 5);
        }

        // Cast photos
        if (selected.cast.length > 0 && castImgs.length > 0) {
          const castY = BY + posterH + 30;
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "bold 14px Arial, sans-serif";
          ctx.fillText("ELENCO PRINCIPAL:", 30, castY);

          const castSize = 60;
          let cx = 30;
          selected.cast.slice(0, 5).forEach((c, i) => {
            const img = castImgs[i];
            if (img) {
              // Circular clip
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx + castSize / 2, castY + 20 + castSize / 2, castSize / 2, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(img, cx, castY + 20, castSize, castSize);
              ctx.restore();

              // Border
              ctx.strokeStyle = "rgba(255,255,255,0.4)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(cx + castSize / 2, castY + 20 + castSize / 2, castSize / 2, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              ctx.fillStyle = "rgba(255,255,255,0.2)";
              ctx.beginPath();
              ctx.arc(cx + castSize / 2, castY + 20 + castSize / 2, castSize / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.font = "bold 20px Arial";
              ctx.fillText(c.name[0], cx + castSize / 2 - 7, castY + 20 + castSize / 2 + 7);
            }

            // Name below
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.font = "11px Arial";
            const nameShort = c.name.split(" ")[0];
            const nw = ctx.measureText(nameShort).width;
            ctx.fillText(nameShort, cx + (castSize - nw) / 2, castY + 20 + castSize + 16);

            cx += castSize + 20;
          });
        }

        // WhatsApp + Logo at bottom
        if (whatsappNumber.trim() || logoImg) {
          const footerY = VIDEO_H + BANNER_H - 60;
          ctx.fillStyle = "rgba(37,211,102,0.2)";
          ctx.fillRect(0, footerY, W, 60);

          if (whatsappNumber.trim()) {
            ctx.fillStyle = "#25D366";
            ctx.font = "bold 24px Arial, sans-serif";
            ctx.fillText(`📱 ${whatsappNumber}`, 30, footerY + 38);
          }

          if (logoImg) {
            const lh = 45;
            const lw = (logoImg.width / logoImg.height) * lh;
            ctx.drawImage(logoImg, W - lw - 30, footerY + 8, lw, lh);
          }
        }

        ctx.restore();
      };

      // Record frames
      recorder.start();

      for (let i = 0; i <= totalFrames; i++) {
        renderFrame(i);
        await new Promise(r => setTimeout(r, 1000 / FPS));
      }

      recorder.stop();

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      toast({ title: "Vídeo gerado com sucesso!" });
    } catch (err: any) {
      console.error("Video generation error:", err);
      toast({ title: "Erro ao gerar vídeo", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [selected, logoUrl, whatsappNumber, title, year, type, duration]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `video-banner-${title.replace(/\s+/g, "-").toLowerCase()}.webm`;
    a.click();
    toast({ title: "Vídeo baixado com sucesso!" });
  };

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
          {/* Trailer Preview */}
          {trailer && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Trailer (YouTube)
              </Label>
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Trailer"
                />
              </div>
            </div>
          )}

          {!trailer && (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <p>Trailer não encontrado para este título</p>
            </div>
          )}

          {/* Banner Info Preview */}
          <div className="rounded-lg overflow-hidden border">
            <div className="relative" style={{ aspectRatio: "1080/608" }}>
              {selected.backdrop_path ? (
                <img
                  src={`${TMDB_IMG}/w1280${selected.backdrop_path}`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="absolute top-3 right-3 h-10 w-auto object-contain drop-shadow-xl" />
              )}
              <div className="absolute bottom-3 left-4">
                <p className="text-white font-black text-lg drop-shadow-lg uppercase">{title}</p>
              </div>
            </div>

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
                    {duration && <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-bold">{duration}</span>}
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
                      <span className="text-[8px] mt-0.5 text-white/70 truncate w-full text-center">{c.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Número do WhatsApp (aparece no vídeo)
            </Label>
            <Input
              placeholder="(11) 99999-9999"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={generateVideo} disabled={generating} className="flex-1">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando vídeo...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Gerar Vídeo Banner
                </>
              )}
            </Button>

            {previewUrl && (
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Baixar Vídeo
              </Button>
            )}
          </div>

          {/* Generated video preview */}
          {previewUrl && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Vídeo Gerado
              </Label>
              <video
                src={previewUrl}
                controls
                className="w-full rounded-lg border"
                style={{ maxHeight: 500 }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
