import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Loader2, Upload, Move, Phone, Trash2, Play, AlertTriangle } from "lucide-react";
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

/** Try to download trailer video via Cobalt proxy, returns blob URL or null */
async function downloadTrailerViaProxy(videoId: string): Promise<string | null> {
  try {
    console.log(`[trailer] Tentando baixar trailer ${videoId} via Cobalt...`);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-video-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ videoId }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[trailer] Cobalt retornou ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      console.warn("[trailer] Cobalt retornou JSON em vez de vídeo:", json);
      return null;
    }

    const blob = await res.blob();
    if (blob.size < 10000) {
      console.warn(`[trailer] Blob muito pequeno: ${blob.size} bytes`);
      return null;
    }

    console.log(`[trailer] Trailer baixado com sucesso: ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn("[trailer] Erro ao baixar trailer:", err);
    return null;
  }
}

/** Load a blob URL into a playable HTMLVideoElement */
function loadVideoElement(blobUrl: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("Erro ao carregar vídeo"));
    video.src = blobUrl;
    video.load();
  });
}

export function VideoBannerPreview({ selected, logoUrl: initialLogoUrl, onBack }: Props) {
  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "SÉRIE" : "FILME";
  const durationText = selected.runtime ? `${Math.floor(selected.runtime / 60)}h ${selected.runtime % 60}min` : null;
  const trailer = selected.videos?.find((v) => v.type === "Trailer") || selected.videos?.[0];
  const backdropUrl = selected.backdrop_path ? `${TMDB_IMG}/w1280${selected.backdrop_path}` : null;
  const posterUrl = selected.poster_path ? `${TMDB_IMG}/w500${selected.poster_path}` : null;

  // Overlay settings
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [logoX, setLogoX] = useState(0.7);
  const [logoY, setLogoY] = useState(0.05);
  const [logoScale, setLogoScale] = useState(0.4);
  const [whatsapp, setWhatsapp] = useState("");
  const [clipDuration, setClipDuration] = useState("15");

  // Assets
  const [backdropImg, setBackdropImg] = useState<HTMLImageElement | null>(null);
  const [posterImg, setPosterImg] = useState<HTMLImageElement | null>(null);
  const [trailerBlobUrl, setTrailerBlobUrl] = useState<string | null>(null);
  const [trailerStatus, setTrailerStatus] = useState<"loading" | "ready" | "failed" | "none">("none");
  const [loadingAssets, setLoadingAssets] = useState(true);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load images + attempt trailer download
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAssets(true);
      const promises: Promise<void>[] = [];

      if (initialLogoUrl) {
        promises.push(
          loadImageViaProxy(initialLogoUrl)
            .then((img) => { if (!cancelled) { setLogoImg(img); setLogoFile(initialLogoUrl); } })
            .catch(() => {})
        );
      }
      if (backdropUrl) {
        promises.push(
          loadImageViaProxy(backdropUrl)
            .then((img) => { if (!cancelled) setBackdropImg(img); })
            .catch(() => {})
        );
      }
      if (posterUrl) {
        promises.push(
          loadImageViaProxy(posterUrl)
            .then((img) => { if (!cancelled) setPosterImg(img); })
            .catch(() => {})
        );
      }

      // Attempt trailer download via Cobalt
      if (trailer?.key) {
        setTrailerStatus("loading");
        promises.push(
          downloadTrailerViaProxy(trailer.key)
            .then((url) => {
              if (!cancelled) {
                if (url) {
                  setTrailerBlobUrl(url);
                  setTrailerStatus("ready");
                } else {
                  setTrailerStatus("failed");
                }
              }
            })
        );
      }

      await Promise.all(promises);
      if (!cancelled) setLoadingAssets(false);
    })();
    return () => { cancelled = true; };
  }, [initialLogoUrl, backdropUrl, posterUrl, trailer?.key]);

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

  // Generate video: uses trailer if available, Ken Burns fallback otherwise
  const handleGenerate = useCallback(async () => {
    if (!backdropImg && !trailerBlobUrl) {
      toast({ title: "Nenhuma imagem ou trailer disponível", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setProgress(0);
    setDownloadUrl(null);

    try {
      const maxDur = Number(clipDuration);
      const FPS = 30;
      const W = 1280;
      const H_VIDEO = 720;
      const WA_BAR_H = whatsapp.trim() ? 50 : 0;
      const INFO_BAR_H = 80;
      const TOTAL_H = H_VIDEO + INFO_BAR_H + WA_BAR_H;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = TOTAL_H;
      const ctx = canvas.getContext("2d")!;

      const useTrailer = !!trailerBlobUrl;
      let videoEl: HTMLVideoElement | null = null;

      if (useTrailer) {
        setStatusText("Carregando trailer...");
        videoEl = await loadVideoElement(trailerBlobUrl!);
        videoEl.currentTime = 0;
      }

      const stream = canvas.captureStream(FPS);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      const castText = selected.cast?.slice(0, 5).map(c => c.name).join(" • ") || "";
      const genreText = selected.genres?.slice(0, 3).map(g => g.name).join(" / ") || "";

      let startTime = 0;

      const drawOverlays = () => {
        // Dark gradient overlay at bottom of video area
        const grad = ctx.createLinearGradient(0, H_VIDEO * 0.5, 0, H_VIDEO);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, H_VIDEO * 0.5, W, H_VIDEO * 0.5);

        // Title text on video
        ctx.fillStyle = "#fff";
        ctx.font = `bold 36px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(title, 20, H_VIDEO - 20);

        // Info bar (dark)
        ctx.fillStyle = "#111";
        ctx.fillRect(0, H_VIDEO, W, INFO_BAR_H);

        if (posterImg) {
          const pH = INFO_BAR_H - 10;
          const pW = pH * (posterImg.width / posterImg.height);
          ctx.drawImage(posterImg, 10, H_VIDEO + 5, pW, pH);
          const textX = pW + 20;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 16px sans-serif";
          ctx.fillText(`${type}  •  ${year}${durationText ? `  •  ${durationText}` : ""}`, textX, H_VIDEO + 28);
          ctx.font = "13px sans-serif";
          ctx.fillStyle = "#ccc";
          if (genreText) ctx.fillText(genreText, textX, H_VIDEO + 48);
          if (castText) {
            ctx.fillStyle = "#999";
            ctx.font = "11px sans-serif";
            ctx.fillText(castText, textX, H_VIDEO + 66);
          }
        } else {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 16px sans-serif";
          ctx.fillText(`${type}  •  ${year}`, 20, H_VIDEO + 35);
        }

        // Logo overlay
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

        // WhatsApp bar
        if (whatsapp.trim() && WA_BAR_H > 0) {
          const barY = H_VIDEO + INFO_BAR_H;
          ctx.fillStyle = "#25D366";
          ctx.fillRect(0, barY, W, WA_BAR_H);
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(30, barY + WA_BAR_H / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#25D366";
          ctx.font = `bold ${Math.round(WA_BAR_H * 0.4)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("✆", 30, barY + WA_BAR_H / 2 + 7);
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(WA_BAR_H * 0.4)}px sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(whatsapp, 54, barY + WA_BAR_H / 2 + 7);
        }
      };

      setStatusText(useTrailer ? "Gravando trailer..." : "Gravando vídeo...");
      recorder.start(100);

      if (useTrailer && videoEl) {
        // --- TRAILER MODE: draw video frames from downloaded trailer ---
        await videoEl.play();
        const actualDur = Math.min(maxDur, videoEl.duration || maxDur);

        const drawTrailerFrame = () => {
          // Draw video frame scaled to fill the video area
          const vw = videoEl!.videoWidth;
          const vh = videoEl!.videoHeight;
          const vAspect = vw / vh;
          const targetAspect = W / H_VIDEO;
          let sx = 0, sy = 0, sw = vw, sh = vh;
          if (vAspect > targetAspect) {
            sw = vh * targetAspect;
            sx = (vw - sw) / 2;
          } else {
            sh = vw / targetAspect;
            sy = (vh - sh) / 2;
          }
          ctx.drawImage(videoEl!, sx, sy, sw, sh, 0, 0, W, H_VIDEO);
          drawOverlays();

          const pct = Math.min(95, Math.round((videoEl!.currentTime / actualDur) * 95));
          setProgress(pct);

          if (!videoEl!.paused && !videoEl!.ended && videoEl!.currentTime < actualDur) {
            requestAnimationFrame(drawTrailerFrame);
          } else {
            videoEl!.pause();
            recorder.stop();
          }
        };

        // Stop video at the desired duration
        const stopVideoTimer = setTimeout(() => {
          if (videoEl && !videoEl.paused) videoEl.pause();
          if (recorder.state === "recording") recorder.stop();
        }, actualDur * 1000 + 500);

        requestAnimationFrame(drawTrailerFrame);

        const finalBlob = await recordingDone;
        clearTimeout(stopVideoTimer);

        if (finalBlob.size < 1000) throw new Error("Vídeo gerado está vazio");
        const url = URL.createObjectURL(finalBlob);
        setDownloadUrl(url);
        setProgress(100);
        setStatusText("");
        toast({ title: "Vídeo com trailer gerado com sucesso!" });

      } else {
        // --- KEN BURNS FALLBACK: animate backdrop image ---
        const totalFrames = maxDur * FPS;
        let frameCount = 0;

        const drawKenBurnsFrame = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const elapsed = (timestamp - startTime) / 1000;
          const t = Math.min(elapsed / maxDur, 1);

          const scale = 1.0 + 0.2 * t;
          const bw = backdropImg!.width;
          const bh = backdropImg!.height;
          const aspect = W / H_VIDEO;
          let sw = bw;
          let sh = sw / aspect;
          if (sh > bh) { sh = bh; sw = sh * aspect; }
          sw /= scale;
          sh /= scale;
          const sx = (bw - sw) / 2 + 30 * t;
          const sy = (bh - sh) / 2 + 15 * t;

          ctx.drawImage(backdropImg!, sx, sy, sw, sh, 0, 0, W, H_VIDEO);
          drawOverlays();

          frameCount++;
          const pct = Math.min(95, Math.round((frameCount / totalFrames) * 95));
          setProgress(pct);

          if (elapsed < maxDur) {
            requestAnimationFrame(drawKenBurnsFrame);
          } else {
            recorder.stop();
          }
        };

        requestAnimationFrame(drawKenBurnsFrame);

        const stopTimer = setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, maxDur * 1000 + 1000);

        const finalBlob = await recordingDone;
        clearTimeout(stopTimer);

        if (finalBlob.size < 1000) throw new Error("Vídeo gerado está vazio");
        const url = URL.createObjectURL(finalBlob);
        setDownloadUrl(url);
        setProgress(100);
        setStatusText("");
        toast({ title: "Vídeo gerado com sucesso (sem trailer - usando animação)" });
      }
    } catch (err: any) {
      console.error("Erro ao gerar vídeo:", err);
      toast({ title: "Erro ao gerar vídeo", description: err?.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [backdropImg, posterImg, trailerBlobUrl, clipDuration, logoImg, logoX, logoY, logoScale, whatsapp, title, type, year, durationText, selected]);

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

  const canGenerate = !loadingAssets && (!!backdropImg || !!trailerBlobUrl);

  const trailerStatusLabel = () => {
    switch (trailerStatus) {
      case "loading": return { icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />, text: "Baixando trailer via Cobalt...", color: "text-muted-foreground" };
      case "ready": return { icon: <Play className="h-4 w-4 text-green-500" />, text: "Trailer baixado — será usado no vídeo!", color: "text-green-600 dark:text-green-400" };
      case "failed": return { icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />, text: "Trailer indisponível — será usado Ken Burns no backdrop", color: "text-yellow-600 dark:text-yellow-400" };
      default: return null;
    }
  };

  const tStatus = trailerStatusLabel();

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
          {/* Trailer Preview (view only, via YouTube embed) */}
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
            ) : backdropUrl ? (
              <div className="aspect-video">
                <img src={backdropUrl} alt={title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center text-muted-foreground">
                <p>Nenhuma imagem disponível para este título</p>
              </div>
            )}
          </div>

          {/* Status indicators */}
          <div className="space-y-1">
            {tStatus && (
              <div className="flex items-center gap-2 text-sm">
                {tStatus.icon}
                <span className={tStatus.color}>{tStatus.text}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              {loadingAssets ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Carregando imagens...</span>
                </>
              ) : backdropImg ? (
                <>
                  <Play className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Imagens prontas</span>
                </>
              ) : (
                <span className="text-destructive text-xs">Imagem de fundo não disponível</span>
              )}
            </div>
          </div>

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
                    <SelectItem value="5">5 segundos</SelectItem>
                    <SelectItem value="10">10 segundos</SelectItem>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                    <SelectItem value="60">60 segundos</SelectItem>
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
                disabled={generating || !canGenerate}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {statusText || "Gerando..."}
                  </>
                ) : !canGenerate ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando imagens...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Criar Vídeo {trailerStatus === "ready" ? "(com trailer)" : "(Ken Burns)"}
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
