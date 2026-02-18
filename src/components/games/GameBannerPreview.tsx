import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Copy, Send, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

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
  const [copying, setCopying] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingActive, setSendingActive] = useState(false);

  const templateProps = { matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, backgroundUrl };

  const generateBlob = async (): Promise<Blob | null> => {
    if (!bannerRef.current) return null;
    const swapped = await proxyAllImages(bannerRef.current);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(bannerRef.current, { useCORS: true, allowTaint: true, scale: 2, logging: false, imageTimeout: 30000 });
      restoreImages(swapped);
      return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob), "image/png"); });
    } catch (err) { restoreImages(swapped); throw err; }
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

  const sendToClients = async (activeOnly: boolean) => {
    const setter = activeOnly ? setSendingActive : setSendingAll;
    setter(true);
    try {
      const { data: clients, error } = await supabase.from("clients").select("id, name, phone, due_date").eq("user_id", userId);
      if (error) throw error;
      let list = clients || [];
      if (activeOnly) {
        const today = new Date().toISOString().slice(0, 10);
        list = list.filter((c) => c.due_date >= today);
      }
      if (list.length === 0) { toast({ title: activeOnly ? "Nenhum cliente ativo" : "Nenhum cliente", variant: "destructive" }); setter(false); return; }

      toast({ title: "Gerando banner..." });
      const blob = await generateBlob();
      if (!blob) { toast({ title: "Erro ao gerar banner", variant: "destructive" }); setter(false); return; }

      const path = `banners/${userId}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("platform-assets").upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("platform-assets").getPublicUrl(path);

      const caption = `⚽ ${title}\n${matches.map((m) => `${m.home.name} x ${m.away.name}`).join("\n")}`;
      const BATCH_SIZE = 10;
      let sent = 0, errors = 0;

      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const batch = list.slice(i, i + BATCH_SIZE);
        const { data, error: sendErr } = await supabase.functions.invoke("evolution-api", {
          body: {
            action: "send-bulk-media",
            imageUrl: publicUrl,
            caption,
            messages: batch.map((c) => ({ phone: c.phone, client_id: c.id, template_type: "game-banner" })),
          },
        });
        if (sendErr) errors += batch.length;
        else if (data?.results) {
          sent += data.results.filter((r: any) => r.status === "sent").length;
          errors += data.results.filter((r: any) => r.status !== "sent").length;
        }
        if (i + BATCH_SIZE < list.length) await delay(60000);
      }
      toast({ title: "Envio concluído", description: `${sent} enviados, ${errors} erros de ${list.length} clientes` });
    } catch (err: any) { toast({ title: "Erro no envio", description: err.message, variant: "destructive" }); }
    finally { setter(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {totalBanners > 1 ? `Banner ${bannerIndex + 1} de ${totalBanners}` : "Preview do Banner"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={bannerRef} style={{ maxWidth: 420, margin: "0 auto" }}>
          {template === "modern" && <ModernTemplate {...templateProps} />}
          {template === "sporty" && <SportyTemplate {...templateProps} />}
          {template === "minimal" && <MinimalTemplate {...templateProps} />}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleCopy} disabled={copying} variant="outline" className="flex-1">
            {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Copiar Imagem
          </Button>
          <Button onClick={() => sendToClients(false)} disabled={sendingAll || sendingActive} className="flex-1">
            {sendingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar para Todos
          </Button>
          <Button onClick={() => sendToClients(true)} disabled={sendingAll || sendingActive} variant="secondary" className="flex-1">
            {sendingActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Enviar para Ativos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
