import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Film,
  Save,
  Upload,
  Loader2,
  Trash2,
  Search,
  ArrowLeft,
  Key,
} from "lucide-react";

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
}

const TMDB_IMG = "https://image.tmdb.org/t/p";

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
      const { data } = await supabase
        .from("tmdb_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setConfig(data as TmdbConfig);
        setApiKey((data as TmdbConfig).api_key);
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
      const {
        data: { publicUrl },
      } = supabase.storage.from("platform-assets").getPublicUrl(path);
      return `${publicUrl}?t=${Date.now()}`;
    } catch (err: any) {
      toast({
        title: "Erro no upload",
        description: err.message,
        variant: "destructive",
      });
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
    if (!apiKey.trim()) {
      toast({
        title: "A chave de API do TMDB é obrigatória",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase
          .from("tmdb_config")
          .update({
            api_key: apiKey,
            logo_url: config.logo_url,
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tmdb_config")
          .insert({
            user_id: user.id,
            api_key: apiKey,
            logo_url: null,
          })
          .select()
          .single();
        if (error) throw error;
        setConfig(data as TmdbConfig);
      }
      toast({ title: "Configuração salva com sucesso" });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Configure sua API Key do TMDB primeiro",
        variant: "destructive",
      });
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
      if (filtered.length === 0) {
        toast({ title: "Nenhum resultado encontrado" });
      }
    } catch (err: any) {
      toast({
        title: "Erro na pesquisa",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (item: TmdbResult) => {
    setLoadingDetails(true);
    try {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const creditsRes = await fetch(
        `https://api.themoviedb.org/3/${type}/${item.id}/credits?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`
      );
      const credits = await creditsRes.json();
      setSelected({
        ...item,
        cast: (credits.cast || []).slice(0, 10),
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
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          Módulo Filmes & Séries
        </h1>
        <p className="text-muted-foreground">
          Configure a integração com o TMDB e pesquise conteúdos
        </p>
      </div>

      {/* Config Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-4 w-4" /> API Key TMDB
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Obtenha sua chave em{" "}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                themoviedb.org
              </a>
            </p>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Insira sua API Key"
            />
          </CardContent>
        </Card>

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-4 w-4" /> Logotipo do Banner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config?.logo_url && (
              <div className="flex items-center gap-3">
                <img
                  src={config.logo_url}
                  alt="Logo"
                  className="h-16 w-auto rounded border object-contain bg-muted p-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setConfig((prev) =>
                      prev ? { ...prev, logo_url: null } : prev
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              variant="outline"
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploadingLogo ? "Enviando..." : "Enviar Logo"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Salvando..." : "Salvar Configuração"}
      </Button>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-4 w-4" /> Pesquisar Filmes & Séries
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome do filme ou série..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details View */}
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {selected.title || selected.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              {selected.poster_path && (
                <img
                  src={`${TMDB_IMG}/w342${selected.poster_path}`}
                  alt={selected.title || selected.name}
                  className="w-48 rounded-lg shadow-md self-start"
                />
              )}
              <div className="flex-1 space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Sinopse
                  </Label>
                  <p className="mt-1 text-sm text-foreground leading-relaxed">
                    {selected.overview || "Sinopse não disponível."}
                  </p>
                </div>
                {selected.cast.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                      Elenco Principal
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {selected.cast.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-col items-center w-16 text-center"
                        >
                          {c.profile_path ? (
                            <img
                              src={`${TMDB_IMG}/w185${c.profile_path}`}
                              alt={c.name}
                              className="h-16 w-16 rounded-full object-cover border-2 border-muted"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              {c.name[0]}
                            </div>
                          )}
                          <span className="text-[10px] mt-1 leading-tight text-foreground font-medium truncate w-full">
                            {c.name}
                          </span>
                          <span className="text-[9px] text-muted-foreground truncate w-full">
                            {c.character}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Grid */}
      {!selected && results.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Resultados
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="group relative rounded-lg overflow-hidden border bg-card shadow-sm hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {r.poster_path ? (
                  <img
                    src={`${TMDB_IMG}/w342${r.poster_path}`}
                    alt={r.title || r.name}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
                    {r.title || r.name}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white font-medium truncate">
                    {r.title || r.name}
                  </p>
                  <p className="text-[10px] text-white/70">
                    {r.media_type === "tv" ? "Série" : "Filme"} •{" "}
                    {(r.release_date || r.first_air_date || "").slice(0, 4)}
                  </p>
                </div>
                {loadingDetails && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviesSeries;
