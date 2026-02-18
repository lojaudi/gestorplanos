import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Gamepad2, Loader2, RefreshCw } from "lucide-react";
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
}

const defaultConfig: FootballUserConfig = {
  logo_url: null,
  whatsapp_number: "",
  custom_title: "Jogos de Hoje",
  primary_color: "#1e3a5f",
  secondary_color: "#ffffff",
  accent_color: "#f59e0b",
};

const GamesDay = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<FootballUserConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Match[]>([]);
  const [leagueFilter, setLeagueFilter] = useState("all");

  const [template, setTemplate] = useState<TemplateType>("modern");
  const [format, setFormat] = useState<"square" | "story">("square");

  // Load user config + platform defaults
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Get platform defaults
      const { data: platform } = await supabase
        .from("platform_settings")
        .select("football_primary_color, football_secondary_color, football_accent_color, football_default_logo_url")
        .limit(1)
        .maybeSingle();

      // Get user config
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

  // Fetch matches on mount
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
      setMatches((json.matches || []).map((m: Match) => ({ ...m, channels: [] })));
    } catch (err: any) {
      toast({ title: "Erro ao buscar jogos", description: err.message, variant: "destructive" });
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleToggleMatch = (match: Match) => {
    setSelectedMatches((prev) => {
      const exists = prev.find((m) => m.id === match.id);
      if (exists) return prev.filter((m) => m.id !== match.id);
      if (prev.length >= 6) { toast({ title: "Máximo 6 jogos", variant: "destructive" }); return prev; }
      return [...prev, match];
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `football-logo/${user.id}.${ext}`;
      const { error } = await supabase.storage.from("platform-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("platform-assets").getPublicUrl(path);
      setConfig((prev) => ({ ...prev, logo_url: `${publicUrl}?t=${Date.now()}` }));
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally { setUploadingLogo(false); }
  };

  const leagues = [...new Set(matches.map((m) => m.league.name))].sort();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-primary" />
            Jogos do Dia
          </h1>
          <p className="text-muted-foreground">Gere banners esportivos e envie para seus clientes</p>
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

      {selectedMatches.length > 0 && (
        <>
          <BannerTemplateSelector selected={template} onChange={setTemplate} />
          <GameBannerPreview
            matches={selectedMatches}
            template={template}
            title={config.custom_title}
            logoUrl={config.logo_url}
            whatsapp={config.whatsapp_number}
            primaryColor={config.primary_color}
            secondaryColor={config.secondary_color}
            accentColor={config.accent_color}
            format={format}
            onFormatChange={setFormat}
            userId={user!.id}
          />
        </>
      )}
    </div>
  );
};

export default GamesDay;
