import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Loader2, Upload, Move, Phone, Trash2 } from "lucide-react";
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

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function clamp(v: number, min: number, max: number): number { return Math.min(max, Math.max(min, v)); }

// ── Canvas preview rendering ──

interface OverlayConfig {
  logoImg: HTMLImageElement | null;
  logoX: number; // 0-1
  logoY: number; // 0-1
  logoScale: number; // 0.1 - 1
  whatsapp: string;
}

function renderPreviewFrame(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  backdropImg: HTMLImageElement | null,
  posterImg: HTMLImageElement | null,
  castImgs: (HTMLImageElement | null)[],
  selected: ContentDetails,
  title: string, type: string, year: string, duration: string | null,
  overlay: OverlayConfig,
  t: number, // animation time 0-1
) {
  const VIDEO_H = Math.round(H * 0.655); // ~608 of 928
  const BANNER_H = H - VIDEO_H;

  // Background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  // Backdrop with Ken Burns
  if (backdropImg) {
    const fadeIn = easeOut(clamp(t / 0.08, 0, 1));
    ctx.globalAlpha = fadeIn;
    const scale = 1.0 + 0.15 * t;
    const sw = W * scale;
    const sh = VIDEO_H * scale;
    ctx.drawImage(backdropImg, (W - sw) / 2 - 25 * t, (VIDEO_H - sh) / 2 - 12 * t, sw, sh);
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
    grad.addColorStop(0, "rgba(0,0,0,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, VIDEO_H);
  }

  // Title animation
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

  // Logo overlay
  if (overlay.logoImg) {
    const maxLogoW = W * 0.4;
    const logoAspect = overlay.logoImg.width / overlay.logoImg.height;
    const logoW = maxLogoW * overlay.logoScale;
    const logoH = logoW / logoAspect;
    const lx = overlay.logoX * (W - logoW);
    const ly = overlay.logoY * (VIDEO_H - logoH);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(overlay.logoImg, lx, ly, logoW, logoH);
    ctx.globalAlpha = 1;
  }

  // Banner section
  const by = VIDEO_H;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, by, W, BANNER_H);

  if (posterImg) {
    ctx.globalAlpha = 0.12;
    ctx.drawImage(posterImg, 0, by, W, BANNER_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(17,17,17,0.88)";
    ctx.fillRect(0, by, W, BANNER_H);
  }

  // Poster
  const posterW = 130, posterH = 195;
  if (posterImg) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 20;
    drawRoundedRect(ctx, 20, by + 20, posterW, posterH, 8);
    ctx.clip();
    ctx.drawImage(posterImg, 20, by + 20, posterW, posterH);
    ctx.restore();
  }

  // Text info
  const textX = 170;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title.toUpperCase(), textX, by + 48, W - textX - 20);

  const badges = [type, year, duration].filter(Boolean) as string[];
  let bx = textX;
  ctx.font = "bold 13px sans-serif";
  badges.forEach((badge) => {
    const bw = ctx.measureText(badge).width + 16;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    drawRoundedRect(ctx, bx, by + 58, bw, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(badge, bx + 8, by + 74);
    bx += bw + 8;
  });

  // Synopsis
  if (selected.overview) {
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const words = selected.overview.split(" ");
    let line = "";
    let ly = by + 106;
    let lc = 0;
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > W - textX - 30) {
        if (++lc > 3) break;
        ctx.fillText(line.trim(), textX, ly);
        line = w + " ";
        ly += 19;
      } else line = test;
    }
    if (lc <= 3 && line.trim()) ctx.fillText(line.trim(), textX, ly);
  }

  // Cast
  const castNames = selected.cast.map(c => c.name);
  if (castNames.length > 0) {
    const castY = by + 180;
    let cx = textX;
    castNames.slice(0, 5).forEach((name, i) => {
      const cImg = castImgs[i];
      const sz = 44;
      if (cImg) {
        drawCircularImage(ctx, cImg, cx, castY, sz);
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

  // WhatsApp bar at bottom
  if (overlay.whatsapp.trim()) {
    const barH = 40;
    const barY = H - barH;
    ctx.fillStyle = "#25D366";
    ctx.fillRect(0, barY, W, barH);

    // WhatsApp icon (simple phone circle)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(30, barY + barH / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#25D366";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✆", 30, barY + barH / 2 + 5);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(overlay.whatsapp, 50, barY + barH / 2 + 6);
  }
}

// ── Component ──

export function VideoBannerPreview({ selected, logoUrl: initialLogoUrl, onBack }: Props) {
  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const duration = selected.runtime ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min` : null;

  // Overlay state
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoFile, setLogoFile] = useState<string | null>(null); // data URL for display
  const [logoX, setLogoX] = useState(0.5);
  const [logoY, setLogoY] = useState(0.1);
  const [logoScale, setLogoScale] = useState(0.5);
  const [whatsapp, setWhatsapp] = useState("");
  const [videoDuration, setVideoDuration] = useState("10");

  // Images
  const [backdropImg, setBackdropImg] = useState<HTMLImageElement | null>(null);
  const [posterImg, setPosterImg] = useState<HTMLImageElement | null>(null);
  const [castImgs, setCastImgs] = useState<(HTMLImageElement | null)[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Canvas
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load images on mount
  useEffect(() => {
    (async () => {
      const backdropUrl = selected.backdrop_path ? `${TMDB_IMG}/w1280${selected.backdrop_path}` : null;
      const posterUrl = selected.poster_path ? `${TMDB_IMG}/w342${selected.poster_path}` : null;

      const promises: Promise<HTMLImageElement | null>[] = [
        backdropUrl ? loadImageViaProxy(backdropUrl).catch(() => null) : Promise.resolve(null),
        posterUrl ? loadImageViaProxy(posterUrl).catch(() => null) : Promise.resolve(null),
      ];

      for (const c of selected.cast.slice(0, 5)) {
        promises.push(
          c.profile_path ? loadImageViaProxy(`${TMDB_IMG}/w185${c.profile_path}`).catch(() => null) : Promise.resolve(null)
        );
      }

      // Load initial logo if provided
      if (initialLogoUrl) {
        promises.push(loadImageViaProxy(initialLogoUrl).catch(() => null));
      }

      const imgs = await Promise.all(promises);
      setBackdropImg(imgs[0]);
      setPosterImg(imgs[1]);
      setCastImgs(imgs.slice(2, 2 + Math.min(selected.cast.length, 5)));

      if (initialLogoUrl && imgs[imgs.length - 1]) {
        setLogoImg(imgs[imgs.length - 1]);
        setLogoFile(initialLogoUrl);
      }

      setImagesLoaded(true);
    })();
  }, [selected, initialLogoUrl]);

  // Render preview
  useEffect(() => {
    if (!imagesLoaded || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = 1080, H = 928;
    canvas.width = W;
    canvas.height = H;

    renderPreviewFrame(ctx, W, H, backdropImg, posterImg, castImgs, selected,
      title, type, year, duration,
      { logoImg, logoX, logoY, logoScale, whatsapp },
      0.5, // static preview at t=0.5
    );
  }, [imagesLoaded, backdropImg, posterImg, castImgs, selected, title, type, year, duration, logoImg, logoX, logoY, logoScale, whatsapp]);

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      setLogoImg(img);
      setLogoFile(img.src);
    } catch {
      toast({ title: "Erro ao carregar logo", variant: "destructive" });
    }
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // Generate MP4
  const handleGenerate = useCallback(async () => {
    if (typeof VideoEncoder === "undefined") {
      toast({ title: "Seu navegador não suporta WebCodecs. Use o Google Chrome.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setProgress(0);
    setDownloadUrl(null);

    try {
      // Use lower resolution for reliability
      const W = 720, H = 618;
      const FPS = 12;
      const durationS = Number(videoDuration);
      const TOTAL_FRAMES = FPS * durationS;
      const FRAME_DURATION_US = Math.round(1_000_000 / FPS);

      setStatusText("Preparando encoder...");
      setProgress(5);

      const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

      const codecs = ["avc1.42001f", "avc1.4d001f", "avc1.640029"];
      let selectedCodec = "";
      for (const c of codecs) {
        const s = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 2_000_000, framerate: FPS });
        if (s.supported) { selectedCodec = c; break; }
      }
      if (!selectedCodec) throw new Error("Navegador não suporta codificação H.264. Use o Google Chrome.");

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({ target, video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });

      const chunks: { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }[] = [];
      const encoder = new VideoEncoder({
        output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta); },
        error: (e) => console.error("Encoder error:", e),
      });
      encoder.configure({ codec: selectedCodec, width: W, height: H, bitrate: 2_000_000, framerate: FPS, latencyMode: "quality" });

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      setStatusText("Renderizando frames...");

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const t = i / TOTAL_FRAMES;

        renderPreviewFrame(ctx, W, H, backdropImg, posterImg, castImgs, selected,
          title, type, year, duration,
          { logoImg, logoX, logoY, logoScale, whatsapp },
          t,
        );

        const timestamp = i * FRAME_DURATION_US;
        const frame = new VideoFrame(canvas, { timestamp, duration: FRAME_DURATION_US });

        // Wait if encoder queue is backing up
        while (encoder.encodeQueueSize > 2) {
          await new Promise(r => setTimeout(r, 20));
        }

        encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
        frame.close();

        const pct = 5 + Math.round((i / TOTAL_FRAMES) * 90);
        setProgress(pct);

        // Yield to main thread EVERY frame to prevent freezing
        await new Promise(r => setTimeout(r, 0));

        // Flush every 6 frames (0.5 second)
        if ((i + 1) % 6 === 0) {
          await encoder.flush();
        }
      }

      setStatusText("Finalizando MP4...");
      await encoder.flush();
      encoder.close();
      muxer.finalize();

      const buffer = target.buffer;
      if (!buffer || buffer.byteLength < 1000) throw new Error("MP4 gerado está vazio");

      const blob = new Blob([buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProgress(100);
      toast({ title: "Vídeo gerado com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao gerar vídeo:", err);
      toast({ title: "Erro ao gerar vídeo", description: err?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setGenerating(false);
      setStatusText("");
    }
  }, [selected, backdropImg, posterImg, castImgs, title, type, year, duration, logoImg, logoX, logoY, logoScale, whatsapp, videoDuration]);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const slug = title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `video-banner-${slug}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!imagesLoaded) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando imagens...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Editar Video Banner — {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Preview */}
          <div ref={containerRef} className="rounded-lg overflow-hidden border bg-black">
            <canvas
              ref={previewCanvasRef}
              className="w-full h-auto"
              style={{ display: "block" }}
            />
          </div>

          {/* Editor Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo controls */}
            <div className="space-y-4">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Upload className="h-4 w-4" /> Logo
              </Label>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {logoImg ? "Trocar Logo" : "Enviar Logo"}
                </Button>
                {logoImg && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setLogoImg(null); setLogoFile(null); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                  </Button>
                )}
              </div>

              {logoImg && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Move className="h-3 w-3" /> Posição Horizontal
                    </Label>
                    <Slider
                      value={[logoX * 100]}
                      onValueChange={([v]) => setLogoX(v / 100)}
                      min={0} max={100} step={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Move className="h-3 w-3" /> Posição Vertical
                    </Label>
                    <Slider
                      value={[logoY * 100]}
                      onValueChange={([v]) => setLogoY(v / 100)}
                      min={0} max={100} step={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tamanho</Label>
                    <Slider
                      value={[logoScale * 100]}
                      onValueChange={([v]) => setLogoScale(v / 100)}
                      min={10} max={100} step={1}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp + Duration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-500" /> WhatsApp
                </Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Aparecerá na barra verde na parte inferior do vídeo
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">Duração do Vídeo</Label>
                <Select value={videoDuration} onValueChange={setVideoDuration}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 segundos</SelectItem>
                    <SelectItem value="10">10 segundos</SelectItem>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="20">20 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {logoFile && (
                <div className="p-2 rounded bg-muted">
                  <p className="text-[10px] text-muted-foreground mb-1">Logo atual:</p>
                  <img src={logoFile} alt="Logo" className="h-12 w-auto object-contain" />
                </div>
              )}
            </div>
          </div>

          {/* Generate + Download */}
          <div className="space-y-3">
            {!downloadUrl ? (
              <Button
                onClick={handleGenerate}
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
                  "Criar Vídeo"
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button onClick={handleDownload} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Video Banner .mp4
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setDownloadUrl(null); setProgress(0); }}
                >
                  Gerar Novamente
                </Button>
              </div>
            )}

            {generating && progress > 0 && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progress}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
