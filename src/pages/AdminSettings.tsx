import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Settings, Save, Upload, Loader2, Trash2, Shield, Eye, EyeOff, MessageSquare, Mail, Gamepad2, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface PlatformSettings {
  id: string;
  system_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  login_bg_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  tmdb_api_key: string;
  whatsapp_verification_enabled: boolean;
  email_verification_enabled: boolean;
  football_api_key: string;
  football_api_provider: string;
  football_timezone: string;
  football_date_format: string;
  football_default_font: string;
  football_primary_color: string;
  football_secondary_color: string;
  football_accent_color: string;
  football_default_logo_url: string | null;
  football_banners_enabled: boolean;
  football_api_key_secondary: string;
  football_api_key_tertiary: string;
  football_apisport_leagues: number[];
  football_footballdata_leagues: string[];
  football_apifootball_leagues: number[];
}

interface ApiSportLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
}

const AdminSettings = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingLoginBg, setUploadingLoginBg] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const loginBgRef = useRef<HTMLInputElement>(null);

  // Evolution API state
  const [globalApiUrl, setGlobalApiUrl] = useState("");
  const [globalApiKey, setGlobalApiKey] = useState("");
  const [hasGlobalConfig, setHasGlobalConfig] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showFootballKey, setShowFootballKey] = useState(false);
  const [showFootballKeySecondary, setShowFootballKeySecondary] = useState(false);
  const [showFootballKeyTertiary, setShowFootballKeyTertiary] = useState(false);
  const [apisportLeagues, setApisportLeagues] = useState<ApiSportLeague[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [footballdataLeagues, setFootballdataLeagues] = useState<ApiSportLeague[]>([]);
  const [loadingFootballdataLeagues, setLoadingFootballdataLeagues] = useState(false);
  const [apifootballLeagues, setApifootballLeagues] = useState<ApiSportLeague[]>([]);
  const [loadingApifootballLeagues, setLoadingApifootballLeagues] = useState(false);
  const callEvolutionApi = useCallback(async (action: string, extraParams = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action, ...extraParams }),
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Erro na requisição");
    return result;
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      setSettings({
        ...data,
        football_apisport_leagues: Array.isArray(data.football_apisport_leagues) 
          ? (data.football_apisport_leagues as number[]) 
          : [],
        football_footballdata_leagues: Array.isArray(data.football_footballdata_leagues) 
          ? (data.football_footballdata_leagues as string[]) 
          : [],
        football_apifootball_leagues: Array.isArray((data as any).football_apifootball_leagues) 
          ? ((data as any).football_apifootball_leagues as number[]) 
          : [],
      } as PlatformSettings);
    }
    setLoading(false);
  };

  const fetchApifootballLeagues = async () => {
    if (!settings?.football_api_key) {
      toast({ title: "Configure a API Key primeiro", variant: "destructive" });
      return;
    }
    setLoadingApifootballLeagues(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/football-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "get-leagues", provider: "api-football" }),
        }
      );
      const json = await res.json();
      if (json.leagues) {
        setApifootballLeagues(json.leagues);
        toast({ title: `${json.leagues.length} ligas encontradas` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar ligas", description: err.message, variant: "destructive" });
    }
    setLoadingApifootballLeagues(false);
  };

  const fetchApisportLeagues = async () => {
    if (!settings?.football_api_key_tertiary) {
      toast({ title: "Configure a API Key primeiro", variant: "destructive" });
      return;
    }
    setLoadingLeagues(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/football-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "get-leagues" }),
        }
      );
      const json = await res.json();
      if (json.leagues) {
        setApisportLeagues(json.leagues);
        toast({ title: `${json.leagues.length} ligas encontradas` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar ligas", description: err.message, variant: "destructive" });
    }
    setLoadingLeagues(false);
  };

  const fetchFootballdataLeagues = async () => {
    if (!settings?.football_api_key_secondary) {
      toast({ title: "Configure a API Key primeiro", variant: "destructive" });
      return;
    }
    setLoadingFootballdataLeagues(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/football-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "get-leagues", provider: "football-data" }),
        }
      );
      const json = await res.json();
      if (json.leagues) {
        setFootballdataLeagues(json.leagues);
        toast({ title: `${json.leagues.length} competições encontradas` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar competições", description: err.message, variant: "destructive" });
    }
    setLoadingFootballdataLeagues(false);
  };

  const fetchGlobalEvolutionConfig = useCallback(async () => {
    try {
      const globalRes = await callEvolutionApi("get-global-config");
      if (globalRes.config) {
        setHasGlobalConfig(true);
        setGlobalApiUrl(globalRes.config.api_url);
        setGlobalApiKey(globalRes.config.api_key);
      }
    } catch {
      // No global config yet
    }
  }, [callEvolutionApi]);

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
      fetchGlobalEvolutionConfig();
    }
  }, [isAdmin, fetchGlobalEvolutionConfig]);

  const uploadFile = async (
    file: File,
    folder: string,
    setUploading: (v: boolean) => void
  ): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${folder}/file.${ext}`;
      const { error } = await supabase.storage
        .from("platform-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from("platform-assets")
        .getPublicUrl(path);
      return `${publicUrl}?t=${Date.now()}`;
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    const url = await uploadFile(file, "logo", setUploadingLogo);
    if (url) setSettings({ ...settings, logo_url: url });
    if (logoRef.current) logoRef.current.value = "";
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    const url = await uploadFile(file, "favicon", setUploadingFavicon);
    if (url) setSettings({ ...settings, favicon_url: url });
    if (faviconRef.current) faviconRef.current.value = "";
  };

  const handleLoginBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    const url = await uploadFile(file, "login-bg", setUploadingLoginBg);
    if (url) setSettings({ ...settings, login_bg_url: url });
    if (loginBgRef.current) loginBgRef.current.value = "";
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        system_name: settings.system_name,
        logo_url: settings.logo_url,
        favicon_url: settings.favicon_url,
        login_bg_url: settings.login_bg_url,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        accent_color: settings.accent_color,
        tmdb_api_key: settings.tmdb_api_key,
        whatsapp_verification_enabled: settings.whatsapp_verification_enabled,
        email_verification_enabled: settings.email_verification_enabled,
        football_api_key: settings.football_api_key,
        football_api_provider: settings.football_api_provider,
        football_timezone: settings.football_timezone,
        football_date_format: settings.football_date_format,
        football_default_font: settings.football_default_font,
        football_primary_color: settings.football_primary_color,
        football_secondary_color: settings.football_secondary_color,
        football_accent_color: settings.football_accent_color,
        football_default_logo_url: settings.football_default_logo_url,
        football_banners_enabled: settings.football_banners_enabled,
        football_api_key_secondary: settings.football_api_key_secondary || null,
        football_api_key_tertiary: settings.football_api_key_tertiary || null,
        football_apisport_leagues: settings.football_apisport_leagues || [],
        football_footballdata_leagues: settings.football_footballdata_leagues || [],
        football_apifootball_leagues: settings.football_apifootball_leagues || [],
      } as any)
      .eq("id", settings.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas com sucesso" });
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;
  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configuração Geral
        </h1>
        <p className="text-muted-foreground">Personalize a aparência e integrações da plataforma</p>
      </div>

      {/* System Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nome do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={settings.system_name}
            onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
            placeholder="Nome da plataforma"
          />
        </CardContent>
      </Card>

      {/* Logo & Favicon */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.logo_url && (
              <div className="flex items-center gap-3">
                <img src={settings.logo_url} alt="Logo" className="h-16 w-auto rounded border object-contain bg-muted p-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettings({ ...settings, logo_url: null })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <Button variant="outline" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
              {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploadingLogo ? "Enviando..." : "Enviar Logo"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Favicon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.favicon_url && (
              <div className="flex items-center gap-3">
                <img src={settings.favicon_url} alt="Favicon" className="h-10 w-10 rounded border object-contain bg-muted p-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettings({ ...settings, favicon_url: null })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
            <input ref={faviconRef} type="file" accept="image/*" className="hidden" onChange={handleFaviconUpload} />
            <Button variant="outline" onClick={() => faviconRef.current?.click()} disabled={uploadingFavicon}>
              {uploadingFavicon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploadingFavicon ? "Enviando..." : "Enviar Favicon"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Login Background */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Imagem de Fundo da Tela de Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Recomendado: imagem JPG ou PNG, resolução mínima de 1920×1080px, tamanho máximo de 2MB.
          </p>
          {settings.login_bg_url && (
            <div className="flex items-center gap-3">
              <img src={settings.login_bg_url} alt="Login Background" className="h-24 w-auto rounded border object-cover bg-muted" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettings({ ...settings, login_bg_url: null })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
          <input ref={loginBgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLoginBgUpload} />
          <Button variant="outline" onClick={() => loginBgRef.current?.click()} disabled={uploadingLoginBg}>
            {uploadingLoginBg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploadingLoginBg ? "Enviando..." : "Enviar Imagem de Fundo"}
          </Button>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cores do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded border"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded border"
                />
                <Input
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de Destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accent_color}
                  onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded border"
                />
                <Input
                  value={settings.accent_color}
                  onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 rounded-lg border p-4">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-auto" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
                style={{ backgroundColor: settings.primary_color }}
              >
                {settings.system_name[0]}
              </div>
            )}
            <div>
              <p className="font-bold" style={{ color: settings.primary_color }}>{settings.system_name}</p>
              <div className="mt-1 flex gap-2">
                <span className="inline-block h-4 w-12 rounded" style={{ backgroundColor: settings.primary_color }} />
                <span className="inline-block h-4 w-12 rounded" style={{ backgroundColor: settings.secondary_color }} />
                <span className="inline-block h-4 w-12 rounded" style={{ backgroundColor: settings.accent_color }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métodos de Verificação de Cadastro</CardTitle>
          <CardDescription>Configure quais métodos de verificação serão exigidos ao criar uma nova conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Verificação por WhatsApp</p>
                <p className="text-sm text-muted-foreground">Envia um código OTP via WhatsApp para confirmar o cadastro</p>
              </div>
            </div>
            <Switch
              checked={settings.whatsapp_verification_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, whatsapp_verification_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Verificação por E-mail</p>
                <p className="text-sm text-muted-foreground">Envia um link de confirmação por e-mail antes de ativar a conta</p>
              </div>
            </div>
            <Switch
              checked={settings.email_verification_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, email_verification_enabled: v })}
            />
          </div>
          {!settings.whatsapp_verification_enabled && !settings.email_verification_enabled && (
            <p className="text-sm text-amber-500 font-medium">⚠️ Nenhum método de verificação ativo. Contas serão criadas sem confirmação.</p>
          )}
        </CardContent>
      </Card>

      {/* TMDB API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Key TMDB</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Chave global utilizada por todos os usuários no módulo de Filmes & Séries.{" "}
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Obter chave
            </a>
          </p>
          <Input
            type="password"
            value={settings.tmdb_api_key ?? ""}
            onChange={(e) => setSettings({ ...settings, tmdb_api_key: e.target.value })}
            placeholder="Insira a API Key do TMDB"
          />
        </CardContent>
      </Card>

      {/* Football / Jogos do Dia Config */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Jogos do Dia – Configurações
          </CardTitle>
          <CardDescription>Configure o módulo de banners esportivos para todos os usuários.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Ativar módulo Jogos do Dia</p>
              <p className="text-sm text-muted-foreground">Permite que usuários gerem banners esportivos</p>
            </div>
            <Switch
              checked={settings.football_banners_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, football_banners_enabled: v })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provedor de Dados</Label>
              <Select value={settings.football_api_provider} onValueChange={(v) => setSettings({ ...settings, football_api_provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api-football">API-Football (api-sports.io)</SelectItem>
                  <SelectItem value="football-data">Football-Data.org</SelectItem>
                  <SelectItem value="apisport">ApiSport.online (SportData)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Select value={settings.football_timezone} onValueChange={(v) => setSettings({ ...settings, football_timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                  <SelectItem value="America/Manaus">Manaus (AMT)</SelectItem>
                  <SelectItem value="America/Fortaleza">Fortaleza (BRT)</SelectItem>
                  <SelectItem value="America/Bahia">Bahia (BRT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {settings.football_api_provider === "api-football" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key - API-Football (api-sports.io)</Label>
                <div className="relative">
                  <Input
                    type={showFootballKey ? "text" : "password"}
                    value={settings.football_api_key ?? ""}
                    onChange={(e) => setSettings({ ...settings, football_api_key: e.target.value })}
                    placeholder="Chave da API-Football (api-sports.io)"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowFootballKey(!showFootballKey)}>
                    {showFootballKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* League selector for api-football */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ligas Selecionadas</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchApifootballLeagues} 
                    disabled={loadingApifootballLeagues}
                  >
                    {loadingApifootballLeagues ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Buscar Ligas
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Busque as ligas disponíveis na API e selecione quais deseja monitorar. Deixe vazio para usar a lista padrão (10 ligas).
                </p>
                {settings.football_apifootball_leagues.length > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {settings.football_apifootball_leagues.length} liga(s) selecionada(s)
                  </p>
                )}
                {apifootballLeagues.length > 0 && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Filtrar ligas..."
                      onChange={(e) => {
                        const filter = e.target.value.toLowerCase();
                        const container = document.getElementById('apifootball-leagues-list');
                        if (container) {
                          Array.from(container.children).forEach((child) => {
                            const text = (child as HTMLElement).textContent?.toLowerCase() || '';
                            (child as HTMLElement).style.display = text.includes(filter) ? '' : 'none';
                          });
                        }
                      }}
                    />
                    <div id="apifootball-leagues-list" className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-1">
                      {apifootballLeagues.map((league) => {
                        const isSelected = settings.football_apifootball_leagues.includes(league.id);
                        return (
                          <label key={league.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const current = settings.football_apifootball_leagues;
                                const next = checked
                                  ? [...current, league.id]
                                  : current.filter((id) => id !== league.id);
                                setSettings({ ...settings, football_apifootball_leagues: next });
                              }}
                            />
                            {league.logo && (
                              <img src={league.logo} alt="" className="h-5 w-5 object-contain" />
                            )}
                            <span className="text-sm">{league.name}</span>
                            {league.country && (
                              <span className="text-xs text-muted-foreground">({league.country})</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {settings.football_api_provider === "football-data" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key - Football-Data.org</Label>
                <div className="relative">
                  <Input
                    type={showFootballKeySecondary ? "text" : "password"}
                    value={settings.football_api_key_secondary ?? ""}
                    onChange={(e) => setSettings({ ...settings, football_api_key_secondary: e.target.value })}
                    placeholder="Chave da Football-Data.org"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowFootballKeySecondary(!showFootballKeySecondary)}>
                    {showFootballKeySecondary ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtenha sua chave em{" "}
                  <a href="https://www.football-data.org/client/register" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    football-data.org
                  </a>
                </p>
              </div>

              {/* League selector for football-data */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Competições Selecionadas</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchFootballdataLeagues} 
                    disabled={loadingFootballdataLeagues}
                  >
                    {loadingFootballdataLeagues ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Buscar Competições
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Busque as competições disponíveis na API e selecione quais deseja monitorar. Deixe vazio para usar a lista padrão.
                </p>
                {settings.football_footballdata_leagues.length > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {settings.football_footballdata_leagues.length} competição(ões) selecionada(s)
                  </p>
                )}
                {footballdataLeagues.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-1">
                    {footballdataLeagues.map((league) => {
                      const isSelected = settings.football_footballdata_leagues.includes(String(league.id));
                      return (
                        <label key={league.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const current = settings.football_footballdata_leagues;
                              const leagueCode = String(league.id);
                              const next = checked
                                ? [...current, leagueCode]
                                : current.filter((code) => code !== leagueCode);
                              setSettings({ ...settings, football_footballdata_leagues: next });
                            }}
                          />
                          {league.logo && (
                            <img src={league.logo} alt="" className="h-5 w-5 object-contain" />
                          )}
                          <span className="text-sm">{league.name}</span>
                          {league.country && (
                            <span className="text-xs text-muted-foreground">({league.country})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {settings.football_api_provider === "apisport" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key - ApiSport.online (SportData)</Label>
                <div className="relative">
                  <Input
                    type={showFootballKeyTertiary ? "text" : "password"}
                    value={settings.football_api_key_tertiary ?? ""}
                    onChange={(e) => setSettings({ ...settings, football_api_key_tertiary: e.target.value })}
                    placeholder="Chave da ApiSport.online"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowFootballKeyTertiary(!showFootballKeyTertiary)}>
                    {showFootballKeyTertiary ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtenha sua chave em{" "}
                  <a href="https://apisport.online/register" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    apisport.online
                  </a>
                </p>
              </div>

              {/* League selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ligas Selecionadas</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchApisportLeagues} 
                    disabled={loadingLeagues}
                  >
                    {loadingLeagues ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Buscar Ligas
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Busque as ligas disponíveis na API e selecione quais deseja monitorar. Deixe vazio para buscar todas.
                </p>
                {settings.football_apisport_leagues.length > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {settings.football_apisport_leagues.length} liga(s) selecionada(s)
                  </p>
                )}
                {apisportLeagues.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-1">
                    {apisportLeagues.map((league) => {
                      const isSelected = settings.football_apisport_leagues.includes(league.id);
                      return (
                        <label key={league.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const current = settings.football_apisport_leagues;
                              const next = checked
                                ? [...current, league.id]
                                : current.filter((id) => id !== league.id);
                              setSettings({ ...settings, football_apisport_leagues: next });
                            }}
                          />
                          {league.logo && (
                            <img src={league.logo} alt="" className="h-5 w-5 object-contain" />
                          )}
                          <span className="text-sm">{league.name}</span>
                          {league.country && (
                            <span className="text-xs text-muted-foreground">({league.country})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Formato de Data/Hora</Label>
              <Select value={settings.football_date_format} onValueChange={(v) => setSettings({ ...settings, football_date_format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM HH:mm">DD/MM HH:mm</SelectItem>
                  <SelectItem value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</SelectItem>
                  <SelectItem value="HH:mm">Apenas hora (HH:mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fonte Padrão</Label>
              <Select value={settings.football_default_font} onValueChange={(v) => setSettings({ ...settings, football_default_font: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Oswald">Oswald</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.football_primary_color} onChange={(e) => setSettings({ ...settings, football_primary_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={settings.football_primary_color} onChange={(e) => setSettings({ ...settings, football_primary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.football_secondary_color} onChange={(e) => setSettings({ ...settings, football_secondary_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={settings.football_secondary_color} onChange={(e) => setSettings({ ...settings, football_secondary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Destaque</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.football_accent_color} onChange={(e) => setSettings({ ...settings, football_accent_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={settings.football_accent_color} onChange={(e) => setSettings({ ...settings, football_accent_color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Configuração Global da API Evolution
          </CardTitle>
          <CardDescription>
            Configure as credenciais da Evolution API. Todos os usuários utilizarão estas credenciais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="global_api_url">URL da API</Label>
            <Input
              id="global_api_url"
              placeholder="https://sua-api.example.com"
              value={globalApiUrl}
              onChange={(e) => setGlobalApiUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="global_api_key">Chave Global da API</Label>
            <div className="relative">
              <Input
                id="global_api_key"
                type={showApiKey ? "text" : "password"}
                placeholder={hasGlobalConfig ? "••••••••••••••••" : "Sua chave da API"}
                value={globalApiKey}
                onChange={(e) => setGlobalApiKey(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={async () => {
              if (!globalApiUrl || !globalApiKey) {
                toast({ title: "Preencha URL e chave da API", variant: "destructive" });
                return;
              }
              setSavingGlobal(true);
              try {
                await callEvolutionApi("save-global-config", {
                  api_url: globalApiUrl,
                  api_key: globalApiKey,
                });
                setHasGlobalConfig(true);
                toast({ title: "Configuração global salva com sucesso!" });
              } catch (err: any) {
                toast({ title: err.message, variant: "destructive" });
              }
              setSavingGlobal(false);
            }} disabled={savingGlobal}>
              {savingGlobal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Configuração Global
            </Button>
            {hasGlobalConfig && <Badge variant="default">Configurada</Badge>}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
};

export default AdminSettings;
