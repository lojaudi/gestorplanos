import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  CreditCard,
  Save,
  Eye,
  EyeOff,
  ExternalLink,
  QrCode,
} from "lucide-react";

interface PaymentLink {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  clients: { name: string; phone: string } | null;
}

export default function PaymentGateway() {
  const { user } = useAuth();
  const [accessToken, setAccessToken] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentLink[]>([]);

  const callMercadoPago = useCallback(async (action: string, extraParams = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-pago`,
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
      const [configRes, paymentsRes] = await Promise.all([
        callMercadoPago("get-config"),
        callMercadoPago("list-payments"),
      ]);
      if (configRes.config) {
        setHasConfig(true);
        setIsEnabled(configRes.config.is_enabled);
        setPixKey(configRes.config.pix_key || "");
        setAccessToken(configRes.config.access_token || "");
      }
      setPayments(paymentsRes.payments || []);
    } catch {
      // Config might not exist yet
    }
    setLoading(false);
  }, [user, callMercadoPago]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!accessToken && !hasConfig && !pixKey) {
      toast({ title: "Informe o Access Token ou a Chave Pix", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await callMercadoPago("save-config", {
        access_token: accessToken || undefined,
        is_enabled: isEnabled,
        pix_key: pixKey,
      });
      setHasConfig(true);
      toast({ title: "Configuração salva com sucesso!" });
      fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const getPaymentUrl = (id: string) => {
    return `${window.location.origin}/pay?id=${id}`;
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
          <CreditCard className="h-6 w-6 text-primary" />
          Gateway de Pagamento
        </h1>
        <p className="text-muted-foreground">
          Configure a integração com Mercado Pago para gerar cobranças Pix
        </p>
      </div>

      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração do Mercado Pago</CardTitle>
          <CardDescription>
            Insira seu Access Token de produção do Mercado Pago para habilitar cobranças Pix.{" "}
            <a
              href="https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Como obter?
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="gateway-toggle" className="font-medium">
              Ativar Gateway de Pagamento
            </Label>
            <Switch
              id="gateway-toggle"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <div className="relative">
              <Input
                id="access-token"
                type={showToken ? "text" : "password"}
                placeholder={hasConfig ? "••••••••••••••••" : "APP_USR-..."}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasConfig && (
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter o token atual
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-key">Chave Pix Fixa (fallback)</Label>
            <Input
              id="pix-key"
              type="text"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usada como alternativa quando o Mercado Pago não estiver ativado. Será inserida nas variáveis {"{meio_de_pagamento}"} e {"{link_pagamento}"}.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Configuração
          </Button>

          {hasConfig && (
            <Badge variant={isEnabled ? "default" : "secondary"} className="ml-2">
              {isEnabled ? "Ativo" : "Inativo"}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Payment Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Links de Pagamento Gerados
          </CardTitle>
          <CardDescription>
            Links gerados a partir da tela de cobranças
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.clients?.name || "—"}
                  </TableCell>
                  <TableCell>
                    R$ {Number(p.amount).toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                      {p.status === "paid" ? "Pago" : p.status === "pending" ? "Pendente" : p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(getPaymentUrl(p.id));
                        toast({ title: "Link copiado!" });
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Nenhum link de pagamento gerado ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
