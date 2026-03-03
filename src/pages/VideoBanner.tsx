import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Clapperboard, Loader2 } from "lucide-react";
import { VideoBannerSearch } from "@/components/video-banner/VideoBannerSearch";
import { VideoBannerResults } from "@/components/video-banner/VideoBannerResults";
import { VideoBannerPreview } from "@/components/video-banner/VideoBannerPreview";

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
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

export interface VideoInfo {
  key: string;
  site: string;
  type: string;
  name: string;
}

export interface ContentDetails extends TmdbResult {
  cast: CastMember[];
  runtime?: number;
  number_of_seasons?: number;
  vote_average?: number;
  genres?: { id: number; name: string }[];
  videos: VideoInfo[];
}

const VideoBanner = () => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [selected, setSelected] = useState<ContentDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: platformData } = await supabase
        .from("platform_settings")
        .select("tmdb_api_key")
        .limit(1)
        .maybeSingle();
      if (platformData?.tmdb_api_key) setApiKey(platformData.tmdb_api_key);

      const { data: configData } = await supabase
        .from("tmdb_config")
        .select("logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (configData?.logo_url) setLogoUrl(configData.logo_url);
      setLoading(false);
    })();
  }, [user]);

  const handleSearch = async () => {
    if (!apiKey.trim()) {
      toast({ title: "API Key do TMDB não configurada", variant: "destructive" });
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
      const [detailsRes, creditsRes, videosRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`),
        fetch(`https://api.themoviedb.org/3/${type}/${item.id}/credits?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`),
        fetch(`https://api.themoviedb.org/3/${type}/${item.id}/videos?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`),
      ]);
      const details = await detailsRes.json();
      const credits = await creditsRes.json();
      const videosData = await videosRes.json();

      let videos = (videosData.results || []).filter((v: any) => v.site === "YouTube");
      if (videos.length === 0) {
        const enRes = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}/videos?api_key=${encodeURIComponent(apiKey)}&language=en-US`);
        const enData = await enRes.json();
        videos = (enData.results || []).filter((v: any) => v.site === "YouTube");
      }

      setSelected({
        ...item,
        backdrop_path: item.backdrop_path || details.backdrop_path,
        cast: (credits.cast || []).slice(0, 10),
        runtime: details.runtime,
        number_of_seasons: details.number_of_seasons,
        vote_average: details.vote_average,
        genres: details.genres,
        videos,
      });
    } catch {
      toast({ title: "Erro ao carregar detalhes", variant: "destructive" });
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
          <Clapperboard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Video Banner
        </h1>
        <p className="text-sm text-muted-foreground">
          Pesquise um título, personalize com sua logo e WhatsApp, e gere o vídeo
        </p>
      </div>

      <VideoBannerSearch
        query={query}
        setQuery={setQuery}
        searching={searching}
        onSearch={handleSearch}
      />

      {selected ? (
        <VideoBannerPreview
          selected={selected}
          logoUrl={logoUrl}
          onBack={() => setSelected(null)}
        />
      ) : (
        <VideoBannerResults
          results={results}
          loadingDetails={loadingDetails}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};

export default VideoBanner;
