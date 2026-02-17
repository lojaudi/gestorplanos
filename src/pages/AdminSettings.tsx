import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Palette, Save, Upload, Loader2, Trash2 } from "lucide-react";

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

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) setSettings(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchSettings();
  }, [isAdmin]);

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
      })
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
          <Palette className="h-6 w-6 text-primary" />
          Configurações Visuais
        </h1>
        <p className="text-muted-foreground">Personalize a aparência da plataforma</p>
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

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
};

export default AdminSettings;
