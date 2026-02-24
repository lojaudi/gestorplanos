import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Gamepad2, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GamesDayConfigSection } from "@/components/games/GamesDayConfigSection";
import { MatchSelectionGrid, Match } from "@/components/games/MatchSelectionGrid";
import { BannerTemplateSelector, TemplateType } from "@/components/games/BannerTemplateSelector";
import { GameBannerPreview } from "@/components/games/GameBannerPreview";

interface FootballUserConfig {
  id?: string;
  logo_url: string | null;
  whatsapp_number: string;
  custom_title: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_url: string | null;
}

const defaultConfig: FootballUserConfig = {
  logo_url: null,
  whatsapp_number: "",
  custom_title: "Jogos de Hoje",
  primary_color: "#1e3a5f",
  secondary_color: "#ffffff",
  accent_color: "#f59e0b",
  background_url: null,
};

const GamesDay = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<FootballUserConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Match[]>([]);
  const [leagueFilter, setLeagueFilter] = useState("all");

  const [template, setTemplate] = useState<TemplateType>("modern");
  const [format, setFormat] = useState<"square" | "story">("square");
  const [generatingPlayer, setGeneratingPlayer] = useState(false);

  // Load user config + platform defaults
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: platform } = await supabase
        .from("platform_settings")
        .select("football_primary_color, football_secondary_color, football_accent_color, football_default_logo_url")
        .limit(1)
        .maybeSingle();

      const { data: userConfig } = await supabase
        .from("football_user_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (userConfig) {
        setConfig({
          id: userConfig.id,
          logo_url: userConfig.logo_url,
          whatsapp_number: userConfig.whatsapp_number || "",
          custom_title: userConfig.custom_title || "Jogos de Hoje",
          primary_color: userConfig.primary_color || (platform as any)?.football_primary_color || "#1e3a5f",
          secondary_color: userConfig.secondary_color || (platform as any)?.football_secondary_color || "#ffffff",
          accent_color: userConfig.accent_color || (platform as any)?.football_accent_color || "#f59e0b",
          background_url: (userConfig as any).background_url || null,
        });
      } else if (platform) {
        setConfig({
          ...defaultConfig,
          primary_color: (platform as any)?.football_primary_color || "#1e3a5f",
          secondary_color: (platform as any)?.football_secondary_color || "#ffffff",
          accent_color: (platform as any)?.football_accent_color || "#f59e0b",
          logo_url: (platform as any)?.football_default_logo_url || null,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (user) fetchMatches();
  }, [user]);

  const fetchMatches = async () => {
    setMatchesLoading(true);
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
      const matchList = (json.matches || []).map((m: Match) => {
        // Try to find channels from channel map
        const key = Object.keys(channelMap).find((k) => {
          const kLower = k.toLowerCase();
          return kLower.includes(m.home.name.toLowerCase().split(" ")[0]) &&
                 kLower.includes(m.away.name.toLowerCase().split(" ")[0]);
        });
        return { ...m, channels: key ? channelMap[key] : [] };
      });
      setMatches(matchList);
    } catch (err: any) {
      toast({ title: "Erro ao buscar jogos", description: err.message, variant: "destructive" });
    } finally {
      setMatchesLoading(false);
    }
  };

  const DEFAULT_CHANNELS = ["globo", "sportv", "premiere"];

  const handleToggleMatch = (match: Match) => {
    setSelectedMatches((prev) => {
      const exists = prev.find((m) => m.id === match.id);
      if (exists) return prev.filter((m) => m.id !== match.id);
      const withDefaults = { ...match, channels: match.channels?.length ? match.channels : DEFAULT_CHANNELS };
      // Also update in matches array
      setMatches((all) => all.map((m) => m.id === match.id ? withDefaults : m));
      return [...prev, withDefaults];
    });
  };

  const handleChannelChange = (matchId: number, channels: string[]) => {
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, channels } : m));
    setSelectedMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, channels } : m));
  };

  const handleSaveConfig = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        logo_url: config.logo_url,
        whatsapp_number: config.whatsapp_number || null,
        custom_title: config.custom_title,
        primary_color: config.primary_color || null,
        secondary_color: config.secondary_color || null,
        accent_color: config.accent_color || null,
        background_url: config.background_url || null,
      };
      if (config.id) {
        const { error } = await supabase.from("football_user_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("football_user_config").insert(payload).select().single();
        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }
      toast({ title: "Configuração salva!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (file: File, folder: string): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${folder}/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("platform-assets").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("platform-assets").getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await handleFileUpload(file, "football-logo");
      if (url) setConfig((prev) => ({ ...prev, logo_url: url }));
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally { setUploadingLogo(false); }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const url = await handleFileUpload(file, "football-bg");
      if (url) setConfig((prev) => ({ ...prev, background_url: url }));
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally { setUploadingBg(false); }
  };

  const leagues = [...new Set(matches.map((m) => m.league.name))].sort();

  const handleGeneratePlayer = async () => {
    if (selectedMatches.length === 0) {
      toast({ title: "Selecione ao menos um jogo", variant: "destructive" });
      return;
    }
    setGeneratingPlayer(true);
    try {
      const teams = selectedMatches.flatMap((m) => [
        { name: m.home.name },
        { name: m.away.name },
      ]);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-player-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ teams }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar imagem");
      const newBgUrl = `${json.url}?t=${Date.now()}`;
      setConfig((prev) => ({ ...prev, background_url: newBgUrl }));
      toast({ title: `Jogador do ${json.team} gerado com IA!` });

      // Persist background_url to DB so it survives page refreshes
      if (user) {
        const payload = {
          user_id: user.id,
          background_url: newBgUrl,
        };
        if (config.id) {
          await supabase.from("football_user_config").update({ background_url: newBgUrl }).eq("id", config.id);
        } else {
          const { data } = await supabase.from("football_user_config").insert({
            ...payload,
            logo_url: config.logo_url,
            whatsapp_number: config.whatsapp_number || null,
            custom_title: config.custom_title,
            primary_color: config.primary_color,
            secondary_color: config.secondary_color,
            accent_color: config.accent_color,
          }).select().single();
          if (data) setConfig((prev) => ({ ...prev, id: data.id }));
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar jogador", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPlayer(false);
    }
  };

  // Split selected matches into groups of 6
  const bannerGroups: Match[][] = [];
  for (let i = 0; i < selectedMatches.length; i += 6) {
    bannerGroups.push(selectedMatches.slice(i, i + 6));
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Jogos do Dia
          </h1>
          <p className="text-sm text-muted-foreground">Gere banners esportivos e envie para seus clientes</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMatches} disabled={matchesLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${matchesLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <GamesDayConfigSection
        config={config}
        setConfig={setConfig}
        onSave={handleSaveConfig}
        saving={saving}
        uploadingLogo={uploadingLogo}
        onLogoUpload={handleLogoUpload}
        uploadingBg={uploadingBg}
        onBgUpload={handleBgUpload}
      />

      <MatchSelectionGrid
        matches={matches}
        loading={matchesLoading}
        selected={selectedMatches}
        onToggle={handleToggleMatch}
        onChannelChange={handleChannelChange}
        leagueFilter={leagueFilter}
        onLeagueFilterChange={setLeagueFilter}
        leagues={leagues}
      />

      {bannerGroups.length > 0 && (
        <>
          <BannerTemplateSelector selected={template} onChange={setTemplate} />
          <div className="flex justify-center">
            <Button onClick={handleGeneratePlayer} disabled={generatingPlayer} variant="outline" className="gap-2">
              {generatingPlayer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generatingPlayer ? "Gerando jogador com IA..." : "Gerar Jogador com IA"}
            </Button>
          </div>
          {bannerGroups.map((group, idx) => (
            <GameBannerPreview
              key={idx}
              bannerIndex={idx}
              totalBanners={bannerGroups.length}
              matches={group}
              template={template}
              title={config.custom_title}
              logoUrl={config.logo_url}
              whatsapp={config.whatsapp_number}
              primaryColor={config.primary_color}
              secondaryColor={config.secondary_color}
              accentColor={config.accent_color}
              backgroundUrl={config.background_url}
              userId={user!.id}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default GamesDay;
