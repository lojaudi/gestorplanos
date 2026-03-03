import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Loader2, Upload, Move, Phone, Trash2, Play } from "lucide-react";
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

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadImageViaProxy(url: string): Promise<HTMLImageElement> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/image-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("Proxy error");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return loadImageFromUrl(blobUrl);
}

// ── Component ──

export function VideoBannerPreview({ selected, logoUrl: initialLogoUrl, onBack }: Props) {
  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const durationText = selected.runtime ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min` : null;
  const trailer = selected.videos.find((v) => v.type === "Trailer") || selected.videos[0];

  // Overlay settings
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [logoX, setLogoX] = useState(0.7);
  const [logoY, setLogoY] = useState(0.05);
  const [logoScale, setLogoScale] = useState(0.4);
  const [whatsapp, setWhatsapp] = useState("");
  const [clipDuration, setClipDuration] = useState("30");

  // Video state
  const [trailerBlob, setTrailerBlob] = useState<Blob | null>(null);
  const [downloadingTrailer, setDownloadingTrailer] = useState(false);
  const [trailerError, setTrailerError] = useState<string | null>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load initial logo
  useEffect(() => {
    if (initialLogoUrl) {
      loadImageViaProxy(initialLogoUrl)
        .then((img) => { setLogoImg(img); setLogoFile(initialLogoUrl); })
        .catch(() => {});
    }
  }, [initialLogoUrl]);

  // Download trailer automatically
  useEffect(() => {
    if (!trailer) return;
    let cancelled = false;
    (async () => {
      setDownloadingTrailer(true);
      setTrailerError(null);
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-video-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
          body: JSON.stringify({ videoId: trailer.key }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("video")) throw new Error("Resposta não é vídeo");
        const blob = await res.blob();
        if (blob.size < 10000) throw new Error("Arquivo muito pequeno");
        if (!cancelled) setTrailerBlob(blob);
      } catch (err: any) {
        if (!cancelled) setTrailerError(err.message || "Erro ao baixar trailer");
      } finally {
        if (!cancelled) setDownloadingTrailer(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trailer]);

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

  // ── Generate video using MediaRecorder ──
  // This approach plays the video on a canvas with overlays and records the canvas stream.
  // No frame-by-frame encoding, no VideoEncoder — MediaRecorder handles everything.
  const handleGenerate = useCallback(async () => {
    if (!trailerBlob) {
      toast({ title: "Trailer não disponível", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setProgress(0);
    setDownloadUrl(null);
    setStatusText("Preparando vídeo...");

    try {
      const maxDur = Number(clipDuration);

      // Create hidden video element from trailer blob
      const videoEl = document.createElement("video");
      videoEl.muted = true;
      videoEl.playsInline = true;
      const blobUrl = URL.createObjectURL(trailerBlob);
      videoEl.src = blobUrl;

      await new Promise<void>((resolve, reject) => {
        videoEl.onloadeddata = () => resolve();
        videoEl.onerror = () => reject(new Error("Erro ao carregar trailer"));
        setTimeout(() => reject(new Error("Timeout")), 15000);
      });

      const actualDur = Math.min(videoEl.duration, maxDur);
      const W = videoEl.videoWidth || 720;
      const H_VIDEO = videoEl.videoHeight || 404;
      const WA_BAR_H = whatsapp.trim() ? 50 : 0;
      const TOTAL_H = H_VIDEO + WA_BAR_H;

      // Canvas for compositing
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = TOTAL_H;
      const ctx = canvas.getContext("2d")!;

      // Capture stream from canvas
      const stream = canvas.captureStream(30);
      
      // Check for supported MIME types
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      // Draw loop — runs while video plays
      let animId: number;
      const drawFrame = () => {
        // Draw the trailer video
        ctx.drawImage(videoEl, 0, 0, W, H_VIDEO);

        // Draw logo overlay
        if (logoImg) {
          const maxLogoW = W * 0.35;
          const logoAspect = logoImg.width / logoImg.height;
          const logoW = maxLogoW * logoScale;
          const logoH = logoW / logoAspect;
          const lx = logoX * (W - logoW);
          const ly = logoY * (H_VIDEO - logoH);
          ctx.globalAlpha = 0.9;
          ctx.drawImage(logoImg, lx, ly, logoW, logoH);
          ctx.globalAlpha = 1;
        }

        // Draw WhatsApp bar
        if (whatsapp.trim() && WA_BAR_H > 0) {
          ctx.fillStyle = "#25D366";
          ctx.fillRect(0, H_VIDEO, W, WA_BAR_H);
          // Phone icon circle
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(30, H_VIDEO + WA_BAR_H / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#25D366";
          ctx.font = `bold ${Math.round(WA_BAR_H * 0.35)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("✆", 30, H_VIDEO + WA_BAR_H / 2 + 6);
          // Number
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(WA_BAR_H * 0.4)}px sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(whatsapp, 54, H_VIDEO + WA_BAR_H / 2 + 7);
        }

        // Update progress
        if (videoEl.duration > 0) {
          const pct = Math.min(95, Math.round((videoEl.currentTime / actualDur) * 95));
          setProgress(pct);
        }

        if (!videoEl.paused && !videoEl.ended && videoEl.currentTime < actualDur) {
          animId = requestAnimationFrame(drawFrame);
        } else {
          // Done
          videoEl.pause();
          recorder.stop();
        }
      };

      // Start recording
      setStatusText("Gravando vídeo...");
      recorder.start(100); // collect data every 100ms
      videoEl.currentTime = 0;
      await videoEl.play();
      drawFrame();

      // Stop at max duration
      const stopTimer = setTimeout(() => {
        videoEl.pause();
        cancelAnimationFrame(animId);
        if (recorder.state === "recording") recorder.stop();
      }, actualDur * 1000 + 500);

      const finalBlob = await recordingDone;
      clearTimeout(stopTimer);
      cancelAnimationFrame(animId);
      URL.revokeObjectURL(blobUrl);

      if (finalBlob.size < 1000) throw new Error("Vídeo gerado está vazio");

      const url = URL.createObjectURL(finalBlob);
      setDownloadUrl(url);
      setProgress(100);
      setStatusText("");
      toast({ title: "Vídeo gerado com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao gerar vídeo:", err);
      toast({ title: "Erro ao gerar vídeo", description: err?.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [trailerBlob, clipDuration, logoImg, logoX, logoY, logoScale, whatsapp]);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const slug = title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `video-banner-${slug}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Editar Video — {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trailer Preview */}
          <div className="rounded-lg overflow-hidden border bg-black">
            {trailer ? (
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0&controls=1&modestbranding=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Trailer"
                  style={{ border: "none" }}
                />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center text-muted-foreground">
                <p>Trailer não encontrado para este título</p>
              </div>
            )}
          </div>

          {/* Trailer download status */}
          {trailer && (
            <div className="flex items-center gap-2 text-sm">
              {downloadingTrailer ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Baixando trailer para edição...</span>
                </>
              ) : trailerBlob ? (
                <>
                  <Play className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    Trailer pronto ({(trailerBlob.size / 1024 / 1024).toFixed(1)}MB)
                  </span>
                </>
              ) : trailerError ? (
                <span className="text-destructive text-xs">Erro: {trailerError}</span>
              ) : null}
            </div>
          )}

          {/* Editor Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo controls */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Upload className="h-4 w-4" /> Logo (sobreposição no vídeo)
              </Label>

              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" />
                  {logoImg ? "Trocar Logo" : "Enviar Logo"}
                </Button>
                {logoImg && (
                  <Button variant="outline" size="sm" onClick={() => { setLogoImg(null); setLogoFile(null); }}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                  </Button>
                )}
              </div>

              {logoImg && (
                <div className="space-y-3">
                  {logoFile && (
                    <div className="p-2 rounded bg-muted">
                      <img src={logoFile} alt="Logo" className="h-10 w-auto object-contain" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Move className="h-3 w-3" /> Posição Horizontal
                    </Label>
                    <Slider value={[logoX * 100]} onValueChange={([v]) => setLogoX(v / 100)} min={0} max={100} step={1} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Move className="h-3 w-3" /> Posição Vertical
                    </Label>
                    <Slider value={[logoY * 100]} onValueChange={([v]) => setLogoY(v / 100)} min={0} max={100} step={1} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tamanho</Label>
                    <Slider value={[logoScale * 100]} onValueChange={([v]) => setLogoScale(v / 100)} min={10} max={100} step={1} />
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp + Duration */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
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
                  Aparecerá na barra verde abaixo do vídeo
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">Duração do Clipe</Label>
                <Select value={clipDuration} onValueChange={setClipDuration}>
                  <SelectTrigger className="w-full">
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
              </div>

              {/* Content info */}
              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs font-bold text-foreground">{title}</p>
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{year}</span>
                  {durationText && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{durationText}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Generate + Download */}
          <div className="space-y-3">
            {!downloadUrl ? (
              <Button
                onClick={handleGenerate}
                disabled={generating || !trailerBlob}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {statusText || "Gerando..."}
                  </>
                ) : !trailerBlob ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aguardando download do trailer...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Criar Vídeo
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button onClick={handleDownload} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Vídeo (.webm)
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { setDownloadUrl(null); setProgress(0); }}>
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
