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

interface LeagueGroup {
  leagueName: string;
  leagueLogo: string;
  matches: Match[];
}

const DEFAULT_COLORS = {
  primary: "#0f172a",
  secondary: "#1e293b",
  accent: "#f59e0b",
};

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

export default function TemplatesJD() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [leagueGroups, setLeagueGroups] = useState<LeagueGroup[]>([]);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const bannerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scales, setScales] = useState<number[]>([]);

  useEffect(() => {
    if (user) fetchMatches();
  }, [user]);

  // Update scales on resize
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
  }, [leagueGroups]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
          return kLower.includes(m.home.name.toLowerCase().split(" ")[0]) &&
                 kLower.includes(m.away.name.toLowerCase().split(" ")[0]);
        });
        return { ...m, channels: key ? channelMap[key] : [] };
      });

      setMatches(matchList);

      // Group by league
      const groupMap = new Map<string, LeagueGroup>();
      matchList.forEach((m) => {
        const key = m.league.name;
        if (!groupMap.has(key)) {
          groupMap.set(key, { leagueName: m.league.name, leagueLogo: m.league.logo, matches: [] });
        }
        groupMap.get(key)!.matches.push(m);
      });
      setLeagueGroups(Array.from(groupMap.values()).sort((a, b) => b.matches.length - a.matches.length));
    } catch (err: any) {
      toast({ title: "Erro ao buscar jogos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Load user colors from football_user_config
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
      const canvas = await html2canvas(el, { useCORS: true, allowTaint: true, scale: 2, logging: false, imageTimeout: 30000, width: 1080, height: 1080 });
      restoreImages(swapped);
      el.style.transform = origTransform;
      el.style.transformOrigin = origTransformOrigin;
      return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob), "image/png"); });
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
      if (!blob) { toast({ title: "Erro ao gerar imagem", variant: "destructive" }); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = leagueGroups[idx].leagueName.replace(/[^a-zA-Z0-9]/g, "_");
      a.href = url; a.download = `banner-${safeName}.png`; a.click();
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
      if (!blob) { toast({ title: "Erro ao gerar imagem", variant: "destructive" }); return; }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ title: "Banner copiado!" });
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `banner.png`; a.click();
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
      for (let i = 0; i < leagueGroups.length; i++) {
        const blob = await generateBlob(i);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const safeName = leagueGroups[i].leagueName.replace(/[^a-zA-Z0-9]/g, "_");
          a.href = url; a.download = `banner-${safeName}.png`; a.click();
          URL.revokeObjectURL(url);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      toast({ title: `${leagueGroups.length} banners baixados!` });
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
              Banners automáticos dos jogos do dia — agrupados por campeonato
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMatches} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {leagueGroups.length > 0 && (
              <Button size="sm" onClick={handleDownloadAll} disabled={downloadingAll}>
                {downloadingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Baixar Todos
              </Button>
            )}
          </div>
        </div>

        {/* Color Customization */}
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
                    onChange={(e) => setColors((c) => ({ ...c, primary: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={colors.primary}
                    onChange={(e) => setColors((c) => ({ ...c, primary: e.target.value }))}
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
                    onChange={(e) => setColors((c) => ({ ...c, secondary: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={colors.secondary}
                    onChange={(e) => setColors((c) => ({ ...c, secondary: e.target.value }))}
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
                    onChange={(e) => setColors((c) => ({ ...c, accent: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={colors.accent}
                    onChange={(e) => setColors((c) => ({ ...c, accent: e.target.value }))}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Buscando jogos do dia...</span>
            </CardContent>
          </Card>
        )}

        {/* No matches */}
        {!loading && leagueGroups.length === 0 && (
          <Card>
            <CardContent className="text-center py-16">
              <p className="text-muted-foreground">Nenhum jogo encontrado para hoje.</p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {!loading && leagueGroups.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{matches.length}</p>
                <p className="text-xs text-muted-foreground">Jogos Hoje</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{leagueGroups.length}</p>
                <p className="text-xs text-muted-foreground">Campeonatos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{leagueGroups.length}</p>
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

        {/* Banners */}
        {leagueGroups.map((group, idx) => (
          <Card key={group.leagueName}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <img src={group.leagueLogo} alt="" className="h-6 w-6 object-contain" />
                  {group.leagueName}
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
                  <Button
                    size="sm"
                    onClick={() => handleDownload(idx)}
                    disabled={downloadingIdx === idx || downloadingAll}
                  >
                    {downloadingIdx === idx ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                    Baixar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={(el) => { containerRefs.current[idx] = el; }}
                className="w-full overflow-hidden rounded-lg"
                style={{ height: scales[idx] ? Math.ceil(1080 * scales[idx]) : "auto" }}
              >
                <div
                  ref={(el) => { bannerRefs.current[idx] = el; }}
                  style={{
                    width: 1080,
                    height: 1080,
                    transform: `scale(${scales[idx] || 0.3})`,
                    transformOrigin: "top left",
                  }}
                >
                  <AutoBannerTemplate
                    matches={group.matches}
                    leagueName={group.leagueName}
                    leagueLogo={group.leagueLogo}
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
