import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Wifi,
  WifiOff,
  QrCode,
  Save,
  RefreshCw,
  Trash2,
  LogOut,
  Loader2,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserConfig {
  id: string;
  instance_name: string;
  is_connected: boolean;
}

export default function WhatsApp() {
  const { user, isAdmin } = useAuth();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Admin-only state
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

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch user's instance config
      const { data } = await supabase
        .from("whatsapp_config")
        .select("id, instance_name, is_connected")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setConfig(data);
        setInstanceName(data.instance_name);
      }

      // Admin: fetch global config
      if (isAdmin) {
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
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [user, isAdmin, callEvolutionApi]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Admin: save global config
  const handleSaveGlobal = async () => {
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
  };

  // User: save instance name
  const handleSaveInstance = async () => {
    if (!instanceName) {
      toast({ title: "Informe o nome da instância", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await callEvolutionApi("save-config", { instance_name: instanceName });
      toast({ title: "Instância salva com sucesso!" });
      // Refresh config
      const { data } = await supabase
        .from("whatsapp_config")
        .select("id, instance_name, is_connected")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) setConfig(data);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleCreateInstance = async () => {
    setActionLoading("create");
    try {
      const data = await callEvolutionApi("create-instance");
      if (data?.qrcode?.base64) setQrCode(data.qrcode.base64);
      if (data?.qrcode?.pairingCode) setPairingCode(data.qrcode.pairingCode);
      toast({ title: "Instância criada! Escaneie o QR Code para conectar." });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleGetQrCode = async () => {
    setActionLoading("qr");
    try {
      const data = await callEvolutionApi("get-qrcode");
      if (data?.base64) setQrCode(data.base64);
      if (data?.pairingCode) setPairingCode(data.pairingCode);
      toast({ title: "QR Code atualizado" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleCheckStatus = async () => {
    setActionLoading("status");
    try {
      const data = await callEvolutionApi("connection-status");
      setConfig((prev) => prev ? { ...prev, is_connected: data.is_connected } : prev);
      toast({
        title: data.is_connected ? "WhatsApp conectado!" : "WhatsApp desconectado",
        variant: data.is_connected ? "default" : "destructive",
      });
      if (data.is_connected) {
        setQrCode(null);
        setPairingCode(null);
      }
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleLogout = async () => {
    setActionLoading("logout");
    try {
      await callEvolutionApi("logout-instance");
      setConfig((prev) => prev ? { ...prev, is_connected: false } : prev);
      toast({ title: "Instância deslogada" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleDelete = async () => {
    setActionLoading("delete");
    try {
      await callEvolutionApi("delete-instance");
      setConfig((prev) => prev ? { ...prev, is_connected: false } : prev);
      toast({ title: "Instância deletada" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setActionLoading(null);
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
          <MessageSquare className="h-6 w-6 text-primary" />
          Configuração WhatsApp
        </h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? "Configure a API global e gerencie instâncias"
            : "Conecte seu WhatsApp para envio de cobranças"}
        </p>
      </div>

      {/* Admin: Global API Config */}
      {isAdmin && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Configuração Global da API
            </CardTitle>
            <CardDescription>
              Apenas administradores podem configurar as credenciais da Evolution API.
              Todos os usuários utilizarão estas credenciais.
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
              <Button onClick={handleSaveGlobal} disabled={savingGlobal}>
                {savingGlobal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Configuração Global
              </Button>
              {hasGlobalConfig && (
                <Badge variant="default">Configurada</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              config?.is_connected ? "bg-green-500/10" : "bg-destructive/10"
            }`}
          >
            {config?.is_connected ? (
              <Wifi className="h-6 w-6 text-green-500" />
            ) : (
              <WifiOff className="h-6 w-6 text-destructive" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Status da Conexão</p>
            <Badge variant={config?.is_connected ? "default" : "destructive"}>
              {config?.is_connected ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
          {config && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={!!actionLoading}
            >
              {actionLoading === "status" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Verificar</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Instance Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sua Instância</CardTitle>
          <CardDescription>
            Informe o nome da instância para conectar seu WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance_name">Nome da Instância</Label>
            <Input
              id="instance_name"
              placeholder="minha-instancia"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveInstance} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Instância
          </Button>
        </CardContent>
      </Card>

      {/* Instance Actions */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gerenciar Conexão</CardTitle>
            <CardDescription>
              Crie a instância, conecte via QR Code e gerencie a conexão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCreateInstance} disabled={!!actionLoading}>
                {actionLoading === "create" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 h-4 w-4" />
                )}
                Criar Instância
              </Button>
              <Button variant="outline" onClick={handleGetQrCode} disabled={!!actionLoading}>
                {actionLoading === "qr" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 h-4 w-4" />
                )}
                Gerar QR Code
              </Button>
              {config.is_connected && (
                <Button variant="secondary" onClick={handleLogout} disabled={!!actionLoading}>
                  {actionLoading === "logout" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-4 w-4" />
                  )}
                  Deslogar
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete} disabled={!!actionLoading}>
                {actionLoading === "delete" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Deletar Instância
              </Button>
            </div>

            {/* QR Code Display */}
            {qrCode && (
              <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-6">
                <p className="text-sm font-medium text-foreground">
                  Escaneie o QR Code com seu WhatsApp
                </p>
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="h-64 w-64 rounded-lg"
                />
                {pairingCode && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Ou use o código de pareamento:
                    </p>
                    <p className="font-mono text-lg font-bold tracking-widest text-primary">
                      {pairingCode}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handleCheckStatus}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar Conexão
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
