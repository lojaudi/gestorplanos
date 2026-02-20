import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Film, Loader2 } from "lucide-react";
import { TmdbConfigSection } from "@/components/movies/TmdbConfigSection";
import { TmdbSearchSection } from "@/components/movies/TmdbSearchSection";
import { TmdbResultsGrid } from "@/components/movies/TmdbResultsGrid";
import { BannerPreview } from "@/components/movies/BannerPreview";

interface TmdbConfig {
  id: string;
  user_id: string;
  api_key: string;
  logo_url: string | null;
}

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface ContentDetails extends TmdbResult {
  cast: CastMember[];
  runtime?: number;
  number_of_seasons?: number;
  vote_average?: number;
  genres?: { id: number; name: string }[];
}

const MoviesSeries = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<TmdbConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const [apiKey, setApiKey] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [selected, setSelected] = useState<ContentDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Fetch admin TMDB API key from platform_settings
      const { data: platformData } = await supabase
        .from("platform_settings")
        .select("tmdb_api_key")
        .limit(1)
        .maybeSingle();
      if (platformData?.tmdb_api_key) {
        setApiKey(platformData.tmdb_api_key);
      }
      // Fetch user's own config (logo only)
      const { data } = await supabase
        .from("tmdb_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setConfig(data as TmdbConfig);
      }
      setLoading(false);
    })();
  }, [user]);

  const uploadLogo = async (file: File) => {
    if (!user) return null;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `tmdb-logo/${user.id}.${ext}`;
      const { error } = await supabase.storage
        .from("platform-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("platform-assets").getPublicUrl(path);
      return `${publicUrl}?t=${Date.now()}`;
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadLogo(file);
    if (url) {
      setConfig((prev) => (prev ? { ...prev, logo_url: url } : prev));
    }
    if (logoRef.current) logoRef.current.value = "";
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase
          .from("tmdb_config")
          .update({ logo_url: config.logo_url })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tmdb_config")
          .insert({ user_id: user.id, logo_url: null })
          .select()
          .single();
        if (error) throw error;
        setConfig(data as TmdbConfig);
      }
      toast({ title: "Configuração salva com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!apiKey.trim()) {
      toast({ title: "API Key do TMDB não configurada pelo administrador", variant: "destructive" });
      return;
    }
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(apiKey)}&language=pt-BR&query=${encodeURIComponent(query)}&page=1`
      );
      if (!res.ok) throw new Error("Erro ao buscar no TMDB");
      const json = await res.json();
      const filtered = (json.results || []).filter(
        (r: any) => r.media_type === "movie" || r.media_type === "tv"
      );
      setResults(filtered);
      if (filtered.length === 0) toast({ title: "Nenhum resultado encontrado" });
    } catch (err: any) {
      toast({ title: "Erro na pesquisa", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (item: TmdbResult) => {
    setLoadingDetails(true);
    try {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const [detailsRes, creditsRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`),
        fetch(`https://api.themoviedb.org/3/${type}/${item.id}/credits?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`),
      ]);
      const details = await detailsRes.json();
      const credits = await creditsRes.json();
      setSelected({
        ...item,
        cast: (credits.cast || []).slice(0, 10),
        runtime: details.runtime,
        number_of_seasons: details.number_of_seasons,
        vote_average: details.vote_average,
        genres: details.genres,
      });
    } catch {
      setSelected({ ...item, cast: [] });
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Film className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Módulo Filmes & Séries
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure a integração com o TMDB e gere banners promocionais
        </p>
      </div>

      <TmdbConfigSection
        config={config}
        setConfig={setConfig}
        saving={saving}
        onSave={handleSave}
        uploadingLogo={uploadingLogo}
        onLogoUpload={handleLogoUpload}
      />

      <TmdbSearchSection
        query={query}
        setQuery={setQuery}
        searching={searching}
        onSearch={handleSearch}
      />

      {selected && user && (
        <BannerPreview
          selected={selected}
          logoUrl={config?.logo_url || null}
          onBack={() => setSelected(null)}
          userId={user.id}
        />
      )}

      {!selected && (
        <TmdbResultsGrid
          results={results}
          loadingDetails={loadingDetails}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};

export default MoviesSeries;
