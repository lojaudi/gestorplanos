import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Copy, Download, Loader2 } from "lucide-react";
import { Match } from "./MatchSelectionGrid";
import { TemplateType } from "./BannerTemplateSelector";
import { ModernTemplate } from "./templates/ModernTemplate";
import { SportyTemplate } from "./templates/SportyTemplate";
import { MinimalTemplate } from "./templates/MinimalTemplate";

interface Props {
  matches: Match[];
  template: TemplateType;
  title: string;
  logoUrl: string | null;
  whatsapp: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundUrl?: string | null;
  userId: string;
  bannerIndex: number;
  totalBanners: number;
}



async function imgToDataUrl(url: string): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/image-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function proxyAllImages(container: HTMLDivElement) {
  const imgs = container.querySelectorAll("img");
  const swapped: { el: HTMLImageElement; orig: string }[] = [];
  const origin = window.location.origin;
  await Promise.all(Array.from(imgs).map(async (img) => {
    // Skip data URLs and same-origin images (local channel logos etc.)
    if (img.src.startsWith("data:") || img.src.startsWith(origin)) return;
    const dataUrl = await imgToDataUrl(img.src);
    if (dataUrl) { swapped.push({ el: img, orig: img.src }); img.src = dataUrl; }
  }));
  await Promise.all(swapped.map(({ el }) => new Promise<void>((resolve) => { if (el.complete) return resolve(); el.onload = () => resolve(); el.onerror = () => resolve(); })));
  return swapped;
}

function restoreImages(swapped: { el: HTMLImageElement; orig: string }[]) {
  swapped.forEach(({ el, orig }) => { el.src = orig; });
}

export function GameBannerPreview({ matches, template, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, backgroundUrl, userId, bannerIndex, totalBanners }: Props) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);

  const templateProps = { matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, backgroundUrl };

  // Responsive scaling - fit banner to container width
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const bannerWidth = 1404;
        setScale(Math.min(1, containerWidth / bannerWidth));
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const generateBlob = async (): Promise<Blob | null> => {
    if (!bannerRef.current) return null;
    // Temporarily remove scale transform for full-resolution capture
    const el = bannerRef.current;
    const origTransform = el.style.transform;
    const origTransformOrigin = el.style.transformOrigin;
    el.style.transform = "none";
    el.style.transformOrigin = "";
    const swapped = await proxyAllImages(el);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { useCORS: true, allowTaint: true, scale: 2, logging: false, imageTimeout: 30000, width: 1404, height: 1600 });
      restoreImages(swapped);
      el.style.transform = origTransform;
      el.style.transformOrigin = origTransformOrigin;
      return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob), "image/png"); });
    } catch (err) { restoreImages(swapped); el.style.transform = origTransform; el.style.transformOrigin = origTransformOrigin; throw err; }
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      const blob = await generateBlob();
      if (!blob) { toast({ title: "Erro ao gerar imagem", variant: "destructive" }); return; }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ title: "Banner copiado!" });
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `banner-jogos.png`; a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Banner baixado!" });
      }
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    finally { setCopying(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateBlob();
      if (!blob) { toast({ title: "Erro ao gerar imagem", variant: "destructive" }); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `banner-jogos-${bannerIndex + 1}.png`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Banner baixado com sucesso!" });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    finally { setDownloading(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {totalBanners > 1 ? `Banner ${bannerIndex + 1} de ${totalBanners}` : "Preview do Banner"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={containerRef} className="w-full overflow-hidden rounded-lg" style={{ height: Math.ceil(1600 * scale) }}>
          <div
            ref={bannerRef}
            style={{
              width: 1404,
              height: 1600,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {template === "modern" && <ModernTemplate {...templateProps} />}
            {template === "sporty" && <SportyTemplate {...templateProps} />}
            {template === "minimal" && <MinimalTemplate {...templateProps} />}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleCopy} disabled={copying || downloading} variant="outline" className="flex-1">
            {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Copiar Imagem
          </Button>
          <Button onClick={handleDownload} disabled={copying || downloading} className="flex-1">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Baixar Banner
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
