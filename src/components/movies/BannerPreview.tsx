import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Copy,
  Send,
  Users,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface ContentDetails {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  cast: CastMember[];
}

interface Client {
  id: string;
  name: string;
  phone: string;
  due_date: string;
}

interface Props {
  selected: ContentDetails;
  logoUrl: string | null;
  onBack: () => void;
  userId: string;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}


async function proxyTmdbImages(container: HTMLDivElement): Promise<{ el: HTMLImageElement; orig: string }[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const imgs = container.querySelectorAll("img");
  const swapped: { el: HTMLImageElement; orig: string }[] = [];

  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const src = img.src;
      if (!src.includes("image.tmdb.org")) return;
      try {
        swapped.push({ el: img, orig: src });
        const res = await fetch(`${supabaseUrl}/functions/v1/image-proxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
          },
          body: JSON.stringify({ url: src }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        img.src = dataUrl;
      } catch {
        // keep original
      }
    })
  );
  return swapped;
}

function restoreImages(swapped: { el: HTMLImageElement; orig: string }[]) {
  swapped.forEach(({ el, orig }) => { el.src = orig; });
}

export function BannerPreview({ selected, logoUrl, onBack, userId }: Props) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingActive, setSendingActive] = useState(false);

  const title = selected.title || selected.name || "";
  const year = (selected.release_date || selected.first_air_date || "").slice(0, 4);
  const type = selected.media_type === "tv" ? "Série" : "Filme";

  const generateBannerBlob = async (): Promise<Blob | null> => {
    if (!bannerRef.current) return null;
    const swapped = await proxyTmdbImages(bannerRef.current);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(bannerRef.current, {
        useCORS: false,
        allowTaint: false,
        scale: 2,
      });
      restoreImages(swapped);
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } catch (err) {
      restoreImages(swapped);
      throw err;
    }
  };

  const handleCopyImage = async () => {
    setCopying(true);
    try {
      const blob = await generateBannerBlob();
      if (!blob) {
        toast({ title: "Erro ao gerar imagem", variant: "destructive" });
        setCopying(false);
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast({ title: "Banner copiado para a área de transferência!" });
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `banner-${title.replace(/\s+/g, "-").toLowerCase()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Banner baixado com sucesso!" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao copiar", description: err.message, variant: "destructive" });
    } finally {
      setCopying(false);
    }
  };

  const fetchClients = async (activeOnly: boolean): Promise<Client[]> => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, due_date")
      .eq("user_id", userId);

    if (error) throw error;
    if (!data) return [];

    if (activeOnly) {
      const today = new Date().toISOString().slice(0, 10);
      return data.filter((c) => c.due_date >= today);
    }
    return data;
  };

  const buildMessage = () => {
    let msg = "";
    if (customMessage.trim()) {
      msg += `💬 ${customMessage.trim()}\n\n`;
    }
    msg += `🎬 *${title}* (${year}) - ${type}\n\n`;
    if (selected.overview) {
      msg += `📖 ${selected.overview.slice(0, 200)}${selected.overview.length > 200 ? "..." : ""}\n`;
    }
    return msg;
  };

  const sendToClients = async (activeOnly: boolean) => {
    const setter = activeOnly ? setSendingActive : setSendingAll;
    setter(true);
    try {
      const clients = await fetchClients(activeOnly);
      if (clients.length === 0) {
        toast({
          title: activeOnly
            ? "Nenhum cliente ativo encontrado"
            : "Nenhum cliente encontrado",
          variant: "destructive",
        });
        setter(false);
        return;
      }

      // Generate banner and upload to storage
      toast({ title: "Gerando banner..." });
      const blob = await generateBannerBlob();
      if (!blob) {
        toast({ title: "Erro ao gerar banner", variant: "destructive" });
        setter(false);
        return;
      }

      const bannerPath = `banners/${userId}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("platform-assets")
        .upload(bannerPath, blob, { contentType: "image/png", upsert: true });
      if (uploadError) {
        toast({ title: "Erro ao enviar banner", description: uploadError.message, variant: "destructive" });
        setter(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage
        .from("platform-assets")
        .getPublicUrl(bannerPath);
      const imageUrl = publicUrl;

      const caption = buildMessage();
      const BATCH_SIZE = 10;
      let sent = 0;
      let errors = 0;

      for (let i = 0; i < clients.length; i += BATCH_SIZE) {
        const batch = clients.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase.functions.invoke("evolution-api", {
          body: {
            action: "send-bulk-media",
            imageUrl,
            caption,
            messages: batch.map((c) => ({
              phone: c.phone,
              client_id: c.id,
              template_type: "banner",
            })),
          },
        });

        if (error) {
          errors += batch.length;
        } else if (data?.results) {
          sent += data.results.filter((r: any) => r.status === "sent").length;
          errors += data.results.filter((r: any) => r.status !== "sent").length;
        }

        // Rate limit: wait 60s between batches of 10
        if (i + BATCH_SIZE < clients.length) {
          await delay(60000);
        }
      }

      toast({
        title: `Envio concluído`,
        description: `${sent} enviados, ${errors} erros de ${clients.length} clientes`,
      });
    } catch (err: any) {
      toast({ title: "Erro no envio", description: err.message, variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
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
          {/* Visual Banner */}
          <div
            ref={bannerRef}
            className="relative w-full overflow-hidden rounded-xl"
            style={{ aspectRatio: "16/9" }}
          >
            {/* Background: blurred poster */}
            {selected.poster_path && (
              <img
                src={`${TMDB_IMG}/w780${selected.poster_path}`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm brightness-[0.35]"
              />
            )}
            {!selected.poster_path && (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800" />
            )}

            {/* Content overlay */}
            <div className="relative z-10 flex h-full p-6 gap-5 items-center">
              {/* Poster */}
              {selected.poster_path && (
                <img
                  src={`${TMDB_IMG}/w342${selected.poster_path}`}
                  alt={title}
                  className="h-full w-auto rounded-lg shadow-2xl border-2 border-white/20 object-contain"
                />
              )}

              {/* Info */}
              <div className="flex-1 flex flex-col justify-between h-full text-white min-w-0">
                {/* Logo */}
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-8 w-auto object-contain self-start mb-2"
                  />
                )}

                <div className="space-y-2 flex-1 flex flex-col justify-center">
                  <h2 className="text-xl md:text-2xl font-bold leading-tight drop-shadow-lg">
                    {title}
                  </h2>
                  <p className="text-sm text-white/70 font-medium">
                    {type} • {year}
                  </p>
                  {selected.overview && (
                    <p className="text-sm text-white/90 leading-relaxed line-clamp-4">
                      {selected.overview}
                    </p>
                  )}
                </div>

                {/* Cast */}
                {selected.cast.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {selected.cast.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex flex-col items-center w-10">
                        {c.profile_path ? (
                          <img
                            src={`${TMDB_IMG}/w185${c.profile_path}`}
                            alt={c.name}
                            className="h-10 w-10 rounded-full object-cover border border-white/30"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-[8px] text-white">
                            {c.name[0]}
                          </div>
                        )}
                        <span className="text-[7px] mt-0.5 text-white/70 truncate w-full text-center">
                          {c.name.split(" ")[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom message on banner */}
                {customMessage.trim() && (
                  <div className="mt-2 bg-white/10 backdrop-blur-sm rounded-md px-3 py-1.5 border border-white/20">
                    <p className="text-xs text-white/90 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      {customMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Message field */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Mensagem personalizada (WhatsApp / contato)
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Ex: Assista agora! WhatsApp: (11) 99999-9999"
              className="resize-none"
              rows={2}
              maxLength={300}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {customMessage.length}/300
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleCopyImage}
              disabled={copying}
              variant="outline"
              className="flex-1"
            >
              {copying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copiar Imagem
            </Button>

            <Button
              onClick={() => sendToClients(false)}
              disabled={sendingAll || sendingActive}
              className="flex-1"
            >
              {sendingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar para Todos
            </Button>

            <Button
              onClick={() => sendToClients(true)}
              disabled={sendingAll || sendingActive}
              variant="secondary"
              className="flex-1"
            >
              {sendingActive ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Users className="mr-2 h-4 w-4" />
              )}
              Enviar para Ativos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
