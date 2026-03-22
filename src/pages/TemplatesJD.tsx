import { useEffect, useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Match } from "@/components/games/MatchSelectionGrid";
import { AutoBannerTemplate } from "@/components/games/templates/AutoBannerTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, RefreshCw, Copy, Wand2, Palette } from "lucide-react";

interface TimeGroup {
  label: string;
  matches: Match[];
}

const DEFAULT_COLORS = {
  primary: "#0f172a",
  secondary: "#1e293b",
  accent: "#f59e0b",
};

const DISPLAY_TIMEZONE = "America/Sao_Paulo";

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
  } catch {
    return null;
  }
}

async function proxyAllImages(container: HTMLDivElement) {
  const imgs = container.querySelectorAll("img");
  const swapped: { el: HTMLImageElement; orig: string }[] = [];
  const origin = window.location.origin;

  await Promise.all(
    Array.from(imgs).map(async (img) => {
      if (img.src.startsWith("data:") || img.src.startsWith(origin)) return;
      const dataUrl = await imgToDataUrl(img.src);
      if (dataUrl) {
        swapped.push({ el: img, orig: img.src });
        img.src = dataUrl;
      }
    })
  );

  await Promise.all(
    swapped.map(
      ({ el }) =>
        new Promise<void>((resolve) => {
          if (el.complete) return resolve();
          el.onload = () => resolve();
          el.onerror = () => resolve();
        })
    )
  );

  return swapped;
}

function restoreImages(swapped: { el: HTMLImageElement; orig: string }[]) {
  swapped.forEach(({ el, orig }) => {
    el.src = orig;
  });
}

function getMatchDisplayParts(match: Match) {
  const rawDate = typeof match.date === "string" ? match.date : "";
  const hasExplicitTimezone = /(Z|[+-]\d{2}:\d{2})$/i.test(rawDate);

  if (rawDate && !hasExplicitTimezone) {
    const timeMatch = rawDate.match(/T(\d{2}):(\d{2})/);
    if (timeMatch) {
      return {
        hour: Number(timeMatch[1]),
        minute: Number(timeMatch[2]),
      };
    }
  }

  const baseDate = Number.isFinite(match.timestamp) && match.timestamp > 0
    ? new Date(match.timestamp * 1000)
    : new Date(rawDate);

  if (Number.isNaN(baseDate.getTime())) {
    return { hour: 99, minute: 99 };
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(baseDate);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value || 99),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 99),
  };
}

function getMatchTimeLabel(match: Match) {
  const { hour, minute } = getMatchDisplayParts(match);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getMatchSortValue(match: Match) {
  const { hour, minute } = getMatchDisplayParts(match);
  return hour * 60 + minute;
}

export default function TemplatesJD() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [timeGroups, setTimeGroups] = useState<TimeGroup[]>([]);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const bannerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scales, setScales] = useState<number[]>([]);

  useEffect(() => {
    if (user) fetchMatches();
  }, [user]);

  useEffect(() => {
    const updateScales = () => {
      const newScales = containerRefs.current.map((ref) => {
        if (!ref) return 0.3;
        return Math.min(1, ref.offsetWidth / 1080);
      });
      setScales(newScales);
    };

    updateScales();
    window.addEventListener("resize", updateScales);
    return () => window.removeEventListener("resize", updateScales);
  }, [timeGroups]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/football-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "get-matches" }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao buscar jogos");

      const channelMap: Record<string, string[]> = json.channels || {};
      const matchList: Match[] = (json.matches || []).map((m: Match) => {
        const key = Object.keys(channelMap).find((k) => {
          const kLower = k.toLowerCase();
          return (
            kLower.includes(m.home.name.toLowerCase().split(" ")[0]) &&
            kLower.includes(m.away.name.toLowerCase().split(" ")[0])
          );
        });

        return { ...m, channels: key ? channelMap[key] : [] };
      });

      const sortedMatches = [...matchList].sort((a, b) => {
        const timeDiff = getMatchSortValue(a) - getMatchSortValue(b);
        if (timeDiff !== 0) return timeDiff;

        const timestampA = Number.isFinite(a.timestamp) ? a.timestamp : 0;
        const timestampB = Number.isFinite(b.timestamp) ? b.timestamp : 0;
        if (timestampA !== timestampB) return timestampA - timestampB;

        return `${a.home.name} ${a.away.name}`.localeCompare(`${b.home.name} ${b.away.name}`, "pt-BR");
      });

      setMatches(sortedMatches);

      const groupedByTime = new Map<string, Match[]>();
      sortedMatches.forEach((match) => {
        const timeLabel = getMatchTimeLabel(match);
        const currentMatches = groupedByTime.get(timeLabel) || [];
        currentMatches.push(match);
        groupedByTime.set(timeLabel, currentMatches);
      });

      const groups: TimeGroup[] = [];
      Array.from(groupedByTime.entries())
        .sort(([labelA], [labelB]) => labelA.localeCompare(labelB, "pt-BR"))
        .forEach(([label, groupedMatches]) => {
          for (let i = 0; i < groupedMatches.length; i += 6) {
            groups.push({
              label,
              matches: groupedMatches.slice(i, i + 6),
            });
          }
        });

      setTimeGroups(groups);
    } catch (err: any) {
      toast({ title: "Erro ao buscar jogos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("football_user_config")
        .select("primary_color, secondary_color, accent_color")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setColors({
          primary: data.primary_color || DEFAULT_COLORS.primary,
          secondary: data.secondary_color || DEFAULT_COLORS.secondary,
          accent: data.accent_color || DEFAULT_COLORS.accent,
        });
      }
    })();
  }, [user]);

  const generateBlob = async (idx: number): Promise<Blob | null> => {
    const el = bannerRefs.current[idx];
    if (!el) return null;

    const origTransform = el.style.transform;
    const origTransformOrigin = el.style.transformOrigin;
    el.style.transform = "none";
    el.style.transformOrigin = "";

    const swapped = await proxyAllImages(el);

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        imageTimeout: 30000,
        width: 1080,
        height: 1080,
      });

      restoreImages(swapped);
      el.style.transform = origTransform;
      el.style.transformOrigin = origTransformOrigin;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } catch (err) {
      restoreImages(swapped);
      el.style.transform = origTransform;
      el.style.transformOrigin = origTransformOrigin;
      throw err;
    }
  };

  const handleDownload = async (idx: number) => {
    setDownloadingIdx(idx);
    try {
      const blob = await generateBlob(idx);
      if (!blob) {
        toast({ title: "Erro ao gerar imagem", variant: "destructive" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = `jogos_${timeGroups[idx].label.replace(/[^a-zA-Z0-9]/g, "_")}_${idx + 1}`;
      a.href = url;
      a.download = `banner-${safeName}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Banner baixado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingIdx(null);
    }
  };

  const handleCopy = async (idx: number) => {
    setDownloadingIdx(idx);
    try {
      const blob = await generateBlob(idx);
      if (!blob) {
        toast({ title: "Erro ao gerar imagem", variant: "destructive" });
        return;
      }

      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ title: "Banner copiado!" });
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "banner.png";
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Banner baixado (clipboard indisponível)" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingIdx(null);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < timeGroups.length; i++) {
        const blob = await generateBlob(i);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const safeName = `jogos_${timeGroups[i].label.replace(/[^a-zA-Z0-9]/g, "_")}_${i + 1}`;
          a.href = url;
          a.download = `banner-${safeName}.png`;
          a.click();
          URL.revokeObjectURL(url);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      toast({ title: `${timeGroups.length} banners baixados!` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Wand2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Templates J.D
            </h1>
            <p className="text-sm text-muted-foreground">
              Banners automáticos dos jogos do dia — agrupados por horário
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMatches} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {timeGroups.length > 0 && (
              <Button size="sm" onClick={handleDownloadAll} disabled={downloadingAll}>
                {downloadingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Baixar Todos
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Personalizar Cores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Cor Principal</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={colors.primary}
                    onChange={(e) => setColors((current) => ({ ...current, primary: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={colors.primary}
                    onChange={(e) => setColors((current) => ({ ...current, primary: e.target.value }))}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Cor Secundária</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={colors.secondary}
                    onChange={(e) => setColors((current) => ({ ...current, secondary: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={colors.secondary}
                    onChange={(e) => setColors((current) => ({ ...current, secondary: e.target.value }))}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Cor de Destaque</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={colors.accent}
                    onChange={(e) => setColors((current) => ({ ...current, accent: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={colors.accent}
                    onChange={(e) => setColors((current) => ({ ...current, accent: e.target.value }))}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Buscando jogos do dia...</span>
            </CardContent>
          </Card>
        )}

        {!loading && timeGroups.length === 0 && (
          <Card>
            <CardContent className="text-center py-16">
              <p className="text-muted-foreground">Nenhum jogo encontrado para hoje.</p>
            </CardContent>
          </Card>
        )}

        {!loading && timeGroups.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{matches.length}</p>
                <p className="text-xs text-muted-foreground">Jogos Hoje</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{new Set(matches.map((match) => match.league.name)).size}</p>
                <p className="text-xs text-muted-foreground">Campeonatos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{timeGroups.length}</p>
                <p className="text-xs text-muted-foreground">Banners Gerados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">1080²</p>
                <p className="text-xs text-muted-foreground">Resolução</p>
              </CardContent>
            </Card>
          </div>
        )}

        {timeGroups.map((group, idx) => (
          <Card key={`${group.label}-${idx}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  🕐 {group.label}
                  <span className="text-xs text-muted-foreground font-normal">({group.matches.length} jogos)</span>
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(idx)}
                    disabled={downloadingIdx === idx || downloadingAll}
                  >
                    {downloadingIdx === idx ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Copy className="mr-1 h-3 w-3" />}
                    Copiar
                  </Button>
                  <Button size="sm" onClick={() => handleDownload(idx)} disabled={downloadingIdx === idx || downloadingAll}>
                    {downloadingIdx === idx ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                    Baixar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={(el) => {
                  containerRefs.current[idx] = el;
                }}
                className="w-full overflow-hidden rounded-lg"
                style={{ height: scales[idx] ? Math.ceil(1080 * scales[idx]) : "auto" }}
              >
                <div
                  ref={(el) => {
                    bannerRefs.current[idx] = el;
                  }}
                  style={{
                    width: 1080,
                    height: 1080,
                    transform: `scale(${scales[idx] || 0.3})`,
                    transformOrigin: "top left",
                  }}
                >
                  <AutoBannerTemplate
                    matches={group.matches}
                    leagueName={`JOGOS ${group.label}`}
                    leagueLogo=""
                    primaryColor={colors.primary}
                    secondaryColor={colors.secondary}
                    accentColor={colors.accent}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
