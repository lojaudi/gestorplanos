import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plug, CheckCircle2 } from "lucide-react";

const AdminWhmcs = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiIdentifier, setApiIdentifier] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("whmcs_global_config").select("*").limit(1).maybeSingle();
      if (data) {
        setId(data.id);
        setApiUrl(data.api_url || "");
        setApiIdentifier(data.api_identifier || "");
        setApiSecret(data.api_secret || "");
        setIsEnabled(data.is_enabled);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      api_url: apiUrl.trim().replace(/\/+$/, ""),
      api_identifier: apiIdentifier.trim(),
      api_secret: apiSecret.trim(),
      is_enabled: isEnabled,
    };
    const res = id
      ? await supabase.from("whmcs_global_config").update(payload).eq("id", id)
      : await supabase.from("whmcs_global_config").insert(payload).select().single();
    if (res.error) {
      toast({ title: "Erro ao salvar", description: res.error.message, variant: "destructive" });
    } else {
      if (!id && (res as any).data?.id) setId((res as any).data.id);
      toast({ title: "Configuração salva" });
    }
    setSaving(false);
  };

  const test = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whmcs-sync", {
        body: {
          action: "test-connection",
          config: { api_url: apiUrl.trim().replace(/\/+$/, ""), api_identifier: apiIdentifier.trim(), api_secret: apiSecret.trim() },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Conexão OK", description: `WHMCS v${(data as any).version}` });
    } catch (e: any) {
      toast({ title: "Falha na conexão", description: e.message, variant: "destructive" });
    }
    setTesting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Plug className="h-6 w-6" /> Integração WHMCS
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure as credenciais da API do WHMCS para importar clientes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais</CardTitle>
          <CardDescription>
            Gere uma API Credential no WHMCS em <b>Setup → Staff Management → API Credentials</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL do WHMCS</Label>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://seudominio.com/whmcs"
            />
          </div>
          <div>
            <Label>API Identifier</Label>
            <Input value={apiIdentifier} onChange={(e) => setApiIdentifier(e.target.value)} />
          </div>
          <div>
            <Label>API Secret</Label>
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Integração ativa</Label>
              <p className="text-xs text-muted-foreground">Permite que usuários importem clientes</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={test} disabled={testing || !apiUrl || !apiIdentifier || !apiSecret}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWhmcs;
