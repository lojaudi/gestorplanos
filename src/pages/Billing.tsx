import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Send,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MessageSquare,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Client {
  id: string;
  name: string;
  phone: string;
  due_date: string;
  username: string | null;
  plan_id: string | null;
  service_id: string | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  type: string;
}

interface Service {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  price: number | null;
}

type FilterType = "all" | "due_today" | "overdue" | "next_3_days" | "active";

export default function Billing() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [templateId, setTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixClient, setPixClient] = useState<Client | null>(null);
  const [pixAmount, setPixAmount] = useState("");
  const [pixDescription, setPixDescription] = useState("");
  const [generatingPix, setGeneratingPix] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [fixedPixKey, setFixedPixKey] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [clientsRes, templatesRes, servicesRes, plansRes] = await Promise.all([
      supabase.from("clients").select("id, name, phone, due_date, username, plan_id, service_id").eq("user_id", user.id),
      supabase.from("message_templates").select("*").eq("user_id", user.id),
      supabase.from("services").select("id, name").eq("user_id", user.id),
      supabase.from("plans").select("id, name, price").eq("user_id", user.id),
    ]);
    setClients(clientsRes.data || []);
    setTemplates(templatesRes.data || []);
    setServices(servicesRes.data || []);
    setPlans(plansRes.data || []);

    // Check if gateway is enabled
    try {
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
          body: JSON.stringify({ action: "get-config" }),
        }
      );
      const configData = await res.json();
      setGatewayEnabled(configData.config?.is_enabled || false);
      setFixedPixKey(configData.config?.pix_key || "");
    } catch {
      // ignore
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

  const filteredClients = clients.filter((c) => {
    switch (filter) {
      case "due_today": return c.due_date === today;
      case "overdue": return c.due_date < today;
      case "next_3_days": return c.due_date > today && c.due_date <= in3Days;
      case "active": return c.due_date >= today;
      default: return true;
    }
  });

  const getStatus = (dueDate: string) => {
    if (dueDate < today) return { label: "Vencido", variant: "destructive" as const };
    if (dueDate === today) return { label: "Vence Hoje", variant: "secondary" as const };
    return { label: "Ativo", variant: "default" as const };
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredClients.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const resolveTemplate = (template: Template, client: Client, pixCode?: string, paymentLinkId?: string) => {
    const serviceName = services.find((s) => s.id === client.service_id)?.name || "";
    const planName = plans.find((p) => p.id === client.plan_id)?.name || "";
    const dueDate = new Date(client.due_date + "T12:00:00");
    const formattedDue = dueDate.toLocaleDateString("pt-BR");

    const nextDue = new Date(dueDate);
    nextDue.setMonth(nextDue.getMonth() + 1);
    const formattedNextDue = nextDue.toLocaleDateString("pt-BR");

    const paymentLink = paymentLinkId ? `${window.location.origin}/pay?id=${paymentLinkId}` : "";

    return template.content
      .replace(/{nome}/g, client.name)
      .replace(/{servico}/g, serviceName)
      .replace(/{plano}/g, planName)
      .replace(/{data_vencimento}/g, formattedDue)
      .replace(/{data_pagamento}/g, new Date().toLocaleDateString("pt-BR"))
      .replace(/{proximo_vencimento}/g, formattedNextDue)
      .replace(/{link_pagamento}/g, paymentLink)
      .replace(/{meio_de_pagamento}/g, pixCode || "");
  };

  const callEvolutionApi = async (action: string, extraParams = {}) => {
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
  };

  const callMercadoPago = async (action: string, extraParams = {}) => {
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
  };

  const handleSendBulk = async (overrideClients?: Client[]) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    const targetClients = overrideClients || filteredClients.filter((c) => selected.has(c.id));
    if (targetClients.length === 0) {
      toast({ title: "Selecione pelo menos um cliente", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const hasMeioPagamento = template.content.includes("{meio_de_pagamento}");
      const hasLinkPagamento = template.content.includes("{link_pagamento}");
      const needsMpPix = (hasMeioPagamento || hasLinkPagamento) && gatewayEnabled;
      const useFixedPix = (hasMeioPagamento || hasLinkPagamento) && !gatewayEnabled && !!fixedPixKey;
      const messages = [];

      for (const client of targetClients) {
        let pixCode = "";
        let paymentLinkId = "";

        if (needsMpPix) {
          const plan = plans.find((p) => p.id === client.plan_id);
          const amount = plan?.price;

          if (!amount || amount <= 0) {
            toast({
              title: `Cliente "${client.name}" não tem plano com preço definido. Pulando Pix.`,
              variant: "destructive",
            });
          } else {
            try {
              const pixResult = await callMercadoPago("create-payment", {
                client_id: client.id,
                amount,
                description: `Cobrança - ${client.name}`,
              });
              pixCode = pixResult.pix_copy_paste || "";
              paymentLinkId = pixResult.payment_link_id || "";
            } catch (pixErr: any) {
              console.error("Erro ao gerar Pix para", client.name, pixErr);
              toast({
                title: `Erro ao gerar Pix para ${client.name}: ${pixErr.message}`,
                variant: "destructive",
              });
            }
          }
        } else if (useFixedPix) {
          pixCode = fixedPixKey;
        }

        messages.push({
          phone: client.phone,
          message: resolveTemplate(template, client, pixCode, paymentLinkId),
          client_id: client.id,
          template_type: template.type,
        });
      }

      const result = await callEvolutionApi("send-bulk", { messages });

      const sent = result.results?.filter((r: any) => r.status === "sent").length || 0;
      const errors = result.results?.filter((r: any) => r.status === "error").length || 0;

      toast({
        title: `Envio concluído: ${sent} enviadas, ${errors} erros`,
        variant: errors > 0 ? "destructive" : "default",
      });

      setSelected(new Set());
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const handleGeneratePix = async () => {
    if (!pixClient || !pixAmount) return;
    setGeneratingPix(true);
    try {
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
          body: JSON.stringify({
            action: "create-payment",
            client_id: pixClient.id,
            amount: Number(pixAmount),
            description: pixDescription || `Cobrança - ${pixClient.name}`,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao gerar Pix");

      const paymentUrl = `${window.location.origin}/pay?id=${result.payment_link_id}`;
      await navigator.clipboard.writeText(paymentUrl);
      toast({ title: "Link Pix gerado e copiado para a área de transferência!" });
      setPixDialogOpen(false);
      setPixAmount("");
      setPixDescription("");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setGeneratingPix(false);
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
          <Send className="h-6 w-6 text-primary" />
          Envio de Cobranças
        </h1>
        <p className="text-muted-foreground">
          Envie cobranças individuais ou em massa via WhatsApp
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="cursor-pointer" onClick={() => setFilter("all")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{clients.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("due_today")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Vence Hoje</p>
              <p className="text-lg font-bold">
                {clients.filter((c) => c.due_date === today).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("overdue")}>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Vencidos</p>
              <p className="text-lg font-bold">
                {clients.filter((c) => c.due_date < today).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("active")}>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-lg font-bold">
                {clients.filter((c) => c.due_date >= today).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Send Buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 p-4 border-yellow-500/30 hover:bg-yellow-500/10"
          disabled={sending || !templateId}
          onClick={() => {
            const dueTodayClients = clients.filter((c) => c.due_date === today);
            if (dueTodayClients.length === 0) {
              toast({ title: "Nenhum cliente vencendo hoje", variant: "destructive" });
              return;
            }
            if (!templateId) {
              toast({ title: "Selecione um template primeiro", variant: "destructive" });
              return;
            }
            setFilter("due_today");
            setSelected(new Set(dueTodayClients.map((c) => c.id)));
            handleSendBulk(dueTodayClients);
          }}
        >
          <Clock className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold">Enviar cobrança - Vencendo hoje</span>
          <span className="text-xs text-muted-foreground">
            {clients.filter((c) => c.due_date === today).length} cliente(s)
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 p-4 border-orange-500/30 hover:bg-orange-500/10"
          disabled={sending || !templateId}
          onClick={() => {
            const next3Clients = clients.filter((c) => c.due_date > today && c.due_date <= in3Days);
            if (next3Clients.length === 0) {
              toast({ title: "Nenhum cliente vencendo nos próximos 3 dias", variant: "destructive" });
              return;
            }
            if (!templateId) {
              toast({ title: "Selecione um template primeiro", variant: "destructive" });
              return;
            }
            setFilter("next_3_days");
            setSelected(new Set(next3Clients.map((c) => c.id)));
            handleSendBulk(next3Clients);
          }}
        >
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span className="font-semibold">Enviar cobrança - Próximos 3 dias</span>
          <span className="text-xs text-muted-foreground">
            {clients.filter((c) => c.due_date > today && c.due_date <= in3Days).length} cliente(s)
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 p-4 border-destructive/30 hover:bg-destructive/10"
          disabled={sending || !templateId}
          onClick={() => {
            const overdueClients = clients.filter((c) => c.due_date < today);
            if (overdueClients.length === 0) {
              toast({ title: "Nenhum cliente vencido", variant: "destructive" });
              return;
            }
            if (!templateId) {
              toast({ title: "Selecione um template primeiro", variant: "destructive" });
              return;
            }
            setFilter("overdue");
            setSelected(new Set(overdueClients.map((c) => c.id)));
            handleSendBulk(overdueClients);
          }}
        >
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="font-semibold">Enviar cobrança - Vencido</span>
          <span className="text-xs text-muted-foreground">
            {clients.filter((c) => c.due_date < today).length} cliente(s)
          </span>
        </Button>
      </div>

      {/* Payment Method Indicator */}
      <div className={`flex items-center gap-3 rounded-lg border p-3 ${
        gatewayEnabled
          ? "border-green-500/30 bg-green-500/5"
          : fixedPixKey
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-muted bg-muted/30"
      }`}>
        {gatewayEnabled ? (
          <>
            <QrCode className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Mercado Pago ativo</p>
              <p className="text-xs text-muted-foreground">Cobranças Pix serão geradas automaticamente via API</p>
            </div>
            <Badge variant="default" className="ml-auto bg-green-600 hover:bg-green-600">MP Ativo</Badge>
          </>
        ) : fixedPixKey ? (
          <>
            <QrCode className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Chave Pix fixa</p>
              <p className="text-xs text-muted-foreground">As variáveis de pagamento usarão a chave: <code className="bg-muted px-1 rounded text-xs">{fixedPixKey}</code></p>
            </div>
            <Badge variant="secondary" className="ml-auto">Pix Fixo</Badge>
          </>
        ) : (
          <>
            <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Sem meio de pagamento</p>
              <p className="text-xs text-muted-foreground">Configure o Mercado Pago ou uma chave Pix fixa no Gateway de Pagamento</p>
            </div>
            <Badge variant="outline" className="ml-auto">Inativo</Badge>
          </>
        )}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Disparar Mensagens</CardTitle>
          <CardDescription>
            Selecione o filtro, template e os clientes para enviar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select value={filter} onValueChange={(v) => { setFilter(v as FilterType); setSelected(new Set()); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="due_today">Vence Hoje</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="next_3_days">Próximos 3 dias</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-48">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => handleSendBulk()} disabled={sending || selected.size === 0 || !templateId}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              Enviar ({selected.size})
            </Button>
          </div>

          {/* Client Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredClients.length > 0 && selected.size === filteredClients.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                {gatewayEnabled && <TableHead>Pix</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const status = getStatus(client.due_date);
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(client.id)}
                        onCheckedChange={() => toggleSelect(client.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>
                      {new Date(client.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    {gatewayEnabled && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPixClient(client);
                            setPixDialogOpen(true);
                          }}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Nenhum cliente encontrado com este filtro
                  </TableCell>
              </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pix Generation Dialog */}
      <Dialog open={pixDialogOpen} onOpenChange={setPixDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cobrança Pix</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{pixClient?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="pix-amount">Valor (R$)</Label>
              <Input
                id="pix-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={pixAmount}
                onChange={(e) => setPixAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix-desc">Descrição (opcional)</Label>
              <Input
                id="pix-desc"
                placeholder="Ex: Mensalidade Janeiro"
                value={pixDescription}
                onChange={(e) => setPixDescription(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={generatingPix || !pixAmount}
              onClick={handleGeneratePix}
            >
              {generatingPix ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="mr-2 h-4 w-4" />
              )}
              Gerar e Copiar Link Pix
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
