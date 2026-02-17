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
  const [whatsappNumber, setWhatsappNumber] = useState("");
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
            style={{ aspectRatio: "9/16", maxWidth: 480, margin: "0 auto" }}
          >
            {/* Background: blurred poster */}
            {selected.poster_path && (
              <img
                src={`${TMDB_IMG}/w780${selected.poster_path}`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-md brightness-[0.3]"
              />
            )}
            {!selected.poster_path && (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800" />
            )}

            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Content overlay - vertical layout */}
            <div className="relative z-10 flex flex-col h-full p-5 text-white">
              {/* Top: type label + logo */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-extrabold uppercase tracking-wide drop-shadow-lg">
                    {type}
                  </p>
                  <p className="text-xs text-white/70 font-medium">
                    adicionado em nossa grade
                  </p>
                </div>
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-16 w-auto object-contain drop-shadow-lg"
                  />
                )}
              </div>

              {/* Middle: poster + info side by side */}
              <div className="flex gap-4 min-h-0">
                {selected.poster_path && (
                  <img
                    src={`${TMDB_IMG}/w342${selected.poster_path}`}
                    alt={title}
                    className="w-[40%] rounded-lg shadow-2xl border-2 border-white/20 object-cover self-start"
                  />
                )}
                <div className="flex-1 flex flex-col justify-start min-w-0 pt-2">
                  <h2 className="text-xl font-extrabold leading-tight drop-shadow-lg uppercase">
                    {title}
                  </h2>
                  <p className="text-sm text-white/80 font-semibold mt-1">
                    Lançamento: {year}
                  </p>
                  {selected.overview && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-yellow-400 uppercase mb-1">Sinopse:</p>
                      <p className="text-xs text-white/90 leading-relaxed">
                        {selected.overview.slice(0, 250)}{selected.overview.length > 250 ? "..." : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cast - closer to synopsis */}
              {selected.cast.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-2">
                    Elenco Principal:
                  </p>
                  <div className="flex gap-3 justify-start">
                    {selected.cast.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex flex-col items-center w-12">
                        {c.profile_path ? (
                          <img
                            src={`${TMDB_IMG}/w185${c.profile_path}`}
                            alt={c.name}
                            className="h-12 w-12 rounded-full object-cover border-2 border-white/30"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-xs text-white font-bold">
                            {c.name[0]}
                          </div>
                        )}
                        <span className="text-[8px] mt-1 text-white/80 truncate w-full text-center font-medium">
                          {c.name.split(" ")[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spacer to push bottom content down */}
              <div className="flex-1" />

              {/* "Disponível aqui" + logo */}
              <div className="pt-3 border-t border-white/20 flex items-center gap-3">
                <p className="text-lg font-extrabold uppercase tracking-wide drop-shadow-lg">
                  Disponível aqui
                </p>
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-12 w-auto object-contain drop-shadow-lg"
                  />
                )}
              </div>

              {/* WhatsApp number with icon */}
              {whatsappNumber.trim() && (
                <div className="mt-3 flex items-center gap-3 bg-[#25D366]/20 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-[#25D366]/40">
                  <svg viewBox="0 0 24 24" fill="#25D366" className="h-8 w-8 shrink-0 drop-shadow-lg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-lg font-bold text-white drop-shadow-lg tracking-wide">
                    {whatsappNumber}
                  </span>
                </div>
              )}

              {/* Custom message */}
              {customMessage.trim() && (
                <div className="mt-2 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 border border-white/20">
                  <p className="text-xs text-white/90 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    {customMessage}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp number field */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="#25D366" className="h-5 w-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Número do WhatsApp (aparece no banner)
            </Label>
            <Input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
              maxLength={20}
            />
          </div>

          {/* Message field */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Mensagem personalizada (opcional)
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Ex: Assista agora na nossa plataforma!"
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
