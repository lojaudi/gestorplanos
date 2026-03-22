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
import { Settings, Save, Upload, Loader2, Trash2, Shield, Eye, EyeOff, MessageSquare, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface PlatformSettings {
  id: string;
  system_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  login_bg_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  whatsapp_verification_enabled: boolean;
  email_verification_enabled: boolean;
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
        id: data.id,
        system_name: data.system_name,
        logo_url: data.logo_url,
        favicon_url: data.favicon_url,
        login_bg_url: data.login_bg_url,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        accent_color: data.accent_color,
        whatsapp_verification_enabled: data.whatsapp_verification_enabled,
        email_verification_enabled: data.email_verification_enabled,
      });
    }
    setLoading(false);
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
        whatsapp_verification_enabled: settings.whatsapp_verification_enabled,
        email_verification_enabled: settings.email_verification_enabled,
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
                <Button variant="ghost" size="icon" onClick={() => setSettings({ ...settings, logo_url: null })}>
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
                <Button variant="ghost" size="icon" onClick={() => setSettings({ ...settings, favicon_url: null })}>
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
              <Button variant="ghost" size="icon" onClick={() => setSettings({ ...settings, login_bg_url: null })}>
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
                <input type="color" value={settings.primary_color} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={settings.primary_color} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.secondary_color} onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={settings.secondary_color} onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de Destaque</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.accent_color} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={settings.accent_color} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} className="flex-1" />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold" style={{ backgroundColor: settings.primary_color }}>
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
            <Switch checked={settings.whatsapp_verification_enabled} onCheckedChange={(v) => setSettings({ ...settings, whatsapp_verification_enabled: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Verificação por E-mail</p>
                <p className="text-sm text-muted-foreground">Envia um link de confirmação por e-mail antes de ativar a conta</p>
              </div>
            </div>
            <Switch checked={settings.email_verification_enabled} onCheckedChange={(v) => setSettings({ ...settings, email_verification_enabled: v })} />
          </div>
          {!settings.whatsapp_verification_enabled && !settings.email_verification_enabled && (
            <p className="text-sm text-amber-500 font-medium">⚠️ Nenhum método de verificação ativo. Contas serão criadas sem confirmação.</p>
          )}
        </CardContent>
      </Card>

      {/* Evolution API Global Config */}
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
            <Input id="global_api_url" placeholder="https://sua-api.example.com" value={globalApiUrl} onChange={(e) => setGlobalApiUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="global_api_key">Chave Global da API</Label>
            <div className="relative">
              <Input id="global_api_key" type={showApiKey ? "text" : "password"} placeholder={hasGlobalConfig ? "••••••••••••••••" : "Sua chave da API"} value={globalApiKey} onChange={(e) => setGlobalApiKey(e.target.value)} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowApiKey(!showApiKey)}>
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
                await callEvolutionApi("save-global-config", { api_url: globalApiUrl, api_key: globalApiKey });
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
