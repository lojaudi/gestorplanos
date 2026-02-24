import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Bot,
  Save,
  Receipt,
  RefreshCw,
  Search,
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
  plans: { name: string; price: number | null; duration_months: number } | null;
  services: { name: string } | null;
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
  duration_months: number;
}

type FilterType = "all" | "due_today" | "overdue" | "due_tomorrow" | "active";

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
  const [sendingManualId, setSendingManualId] = useState<string | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  // Automation state
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoBeforeDue, setAutoBeforeDue] = useState(true);
  const [autoOnDue, setAutoOnDue] = useState(true);
  const [autoAfterDue, setAutoAfterDue] = useState(true);
  const [hourBeforeDue, setHourBeforeDue] = useState(10);
  const [hourOnDue, setHourOnDue] = useState(10);
  const [hourAfterDue, setHourAfterDue] = useState(15);
  const [savingAuto, setSavingAuto] = useState(false);
  const [hasAutoConfig, setHasAutoConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [clientsRes, templatesRes, servicesRes, plansRes] = await Promise.all([
      supabase.from("clients").select("id, name, phone, due_date, username, plan_id, service_id, plans(name, price, duration_months), services(name)").eq("user_id", user.id),
      supabase.from("message_templates").select("*").eq("user_id", user.id),
      supabase.from("services").select("id, name").eq("user_id", user.id),
      supabase.from("plans").select("id, name, price, duration_months").eq("user_id", user.id),
    ]);
    setClients((clientsRes.data as Client[]) || []);
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

    // Fetch automation config
    try {
      const { data: autoConfig } = await supabase
        .from("billing_automation_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (autoConfig) {
        setHasAutoConfig(true);
        setAutoEnabled(autoConfig.is_enabled);
        setAutoBeforeDue(autoConfig.notify_before_due);
        setAutoOnDue(autoConfig.notify_on_due);
        setAutoAfterDue(autoConfig.notify_after_due);
        setHourBeforeDue((autoConfig as any).send_hour_before_due ?? autoConfig.send_hour ?? 10);
        setHourOnDue((autoConfig as any).send_hour_on_due ?? autoConfig.send_hour ?? 10);
        setHourAfterDue((autoConfig as any).send_hour_after_due ?? autoConfig.send_hour ?? 15);
      }
    } catch {
      // ignore
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filteredClients = clients.filter((c) => {
    const matchesFilter = (() => {
      switch (filter) {
        case "due_today": return c.due_date === today;
        case "overdue": return c.due_date < today;
        case "due_tomorrow": return c.due_date === tomorrow;
        case "active": return c.due_date >= today;
        default: return true;
      }
    })();
    if (!matchesFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
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

  const resolveTemplate = (
    template: Template,
    client: Client,
    pixCode?: string,
    paymentLinkId?: string,
    overrides?: { nextDueDate?: string },
  ) => {
    const serviceName = client.services?.name || services.find((s) => s.id === client.service_id)?.name || "";
    const plan = client.plans || plans.find((p) => p.id === client.plan_id);
    const planName = plan?.name || "";
    const planPrice = plan?.price != null ? plan.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
    const dueDate = new Date(client.due_date + "T12:00:00");
    const formattedDue = dueDate.toLocaleDateString("pt-BR");

    const durationMonths = plan?.duration_months || 1;
    const defaultNextDue = new Date(dueDate);
    defaultNextDue.setMonth(defaultNextDue.getMonth() + durationMonths);
    const formattedNextDue = overrides?.nextDueDate
      ? new Date(overrides.nextDueDate + "T12:00:00").toLocaleDateString("pt-BR")
      : defaultNextDue.toLocaleDateString("pt-BR");

    const paymentLink = paymentLinkId ? `${window.location.origin}/pay?id=${paymentLinkId}` : (pixCode || "");

    return template.content
      .replace(/{nome}/g, client.name)
      .replace(/{servico}/g, serviceName)
      .replace(/{plano}/g, planName)
      .replace(/{valor_plano}/g, planPrice)
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
          const plan = client.plans || plans.find((p) => p.id === client.plan_id);
          const amount = plan?.price;

          if (!amount || amount <= 0) {
            // Fallback to fixed pix key if no plan price
            if (fixedPixKey) {
              pixCode = fixedPixKey;
            } else {
              toast({
                title: `Cliente "${client.name}" não tem plano com preço definido. Pulando Pix.`,
                variant: "destructive",
              });
            }
          } else {
            try {
              const pixResult = await callMercadoPago("create-payment", {
                client_id: client.id,
                amount,
                description: `Cobrança - ${client.name}`,
              });
              if (pixResult.success === false) {
                // MP failed, use fallback
                pixCode = pixResult.fallback_pix_key || fixedPixKey || "";
              } else {
                pixCode = pixResult.pix_copy_paste || "";
                paymentLinkId = pixResult.payment_link_id || "";
              }
            } catch (pixErr: any) {
              console.error("Erro ao gerar Pix para", client.name, pixErr);
              // Fallback to fixed pix key on MP error
              if (fixedPixKey) {
                pixCode = fixedPixKey;
                console.log(`Usando chave Pix fixa como fallback para ${client.name}`);
              } else {
                toast({
                  title: `Erro ao gerar Pix para ${client.name}: ${pixErr.message}`,
                  variant: "destructive",
                });
              }
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

      // Handle MP failure with fallback
      if (result.success === false) {
        const fallbackKey = result.fallback_pix_key || fixedPixKey;
        if (fallbackKey) {
          await navigator.clipboard.writeText(fallbackKey);
          toast({ title: "Mercado Pago indisponível. Chave Pix fixa copiada." });
        } else {
          toast({ title: result.error || "Erro ao gerar Pix", variant: "destructive" });
        }
        setPixDialogOpen(false);
        setPixAmount("");
        setPixDescription("");
      } else {
        const paymentUrl = `${window.location.origin}/pay?id=${result.payment_link_id}`;
        await navigator.clipboard.writeText(paymentUrl);
        toast({ title: "Link Pix gerado e copiado para a área de transferência!" });
        setPixDialogOpen(false);
        setPixAmount("");
        setPixDescription("");
      }
    } catch (err: any) {
      if (fixedPixKey) {
        await navigator.clipboard.writeText(fixedPixKey);
        toast({ title: "Mercado Pago indisponível. Chave Pix fixa copiada." });
        setPixDialogOpen(false);
        setPixAmount("");
        setPixDescription("");
      } else {
        toast({ title: err.message, variant: "destructive" });
      }
    }
    setGeneratingPix(false);
  };

  const handleSaveAutomation = async () => {
    if (!user) return;
    setSavingAuto(true);
    try {
      const payload: any = {
        is_enabled: autoEnabled,
        notify_before_due: autoBeforeDue,
        notify_on_due: autoOnDue,
        notify_after_due: autoAfterDue,
        send_hour_before_due: hourBeforeDue,
        send_hour_on_due: hourOnDue,
        send_hour_after_due: hourAfterDue,
      };
      if (hasAutoConfig) {
        await supabase
          .from("billing_automation_config")
          .update(payload)
          .eq("user_id", user.id);
      } else {
        await supabase.from("billing_automation_config").insert({
          user_id: user.id,
          ...payload,
        });
        setHasAutoConfig(true);
      }
      toast({ title: "Configuração de automação salva!" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setSavingAuto(false);
  };

  const handleManualBilling = async (client: Client) => {
    const manualTemplate = templates.find((t) => t.type === "cobranca_manual");
    if (!manualTemplate) {
      toast({
        title: "Template não encontrado",
        description: "Crie um template do tipo 'Cobrança Manual' na página de Templates antes de usar esta função.",
        variant: "destructive",
      });
      return;
    }
    setSendingManualId(client.id);
    try {
      let pixCode = "";
      let paymentLinkId = "";
      if (gatewayEnabled) {
        const plan = client.plans || plans.find((p) => p.id === client.plan_id);
        if (plan?.price && plan.price > 0) {
          try {
            const pixResult = await callMercadoPago("create-payment", {
              client_id: client.id,
              amount: plan.price,
              description: `Cobrança Manual - ${client.name}`,
            });
            if (pixResult.success === false) {
              pixCode = pixResult.fallback_pix_key || fixedPixKey || "";
            } else {
              pixCode = pixResult.pix_copy_paste || "";
              paymentLinkId = pixResult.payment_link_id || "";
            }
          } catch {
            if (fixedPixKey) pixCode = fixedPixKey;
          }
        } else if (fixedPixKey) {
          pixCode = fixedPixKey;
        }
      } else if (fixedPixKey) {
        pixCode = fixedPixKey;
      }

      const messageContent = resolveTemplate(manualTemplate, client, pixCode, paymentLinkId);
      await callEvolutionApi("send-bulk", {
        messages: [{ phone: client.phone, message: messageContent, client_id: client.id, template_type: "cobranca_manual" }],
      });
      toast({ title: "Cobrança enviada!", description: `Mensagem enviada para ${client.name}` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar cobrança", description: err.message, variant: "destructive" });
    }
    setSendingManualId(null);
  };

  const handleConfirmPayment = async (client: Client) => {
    const confirmTemplate = templates.find((t) => t.type === "confirmacao_pagamento");
    if (!confirmTemplate) {
      toast({
        title: "Template não encontrado",
        description: "Crie um template do tipo 'Confirmação de Pagamento' na página de Templates antes de usar esta função.",
        variant: "destructive",
      });
      return;
    }
    setConfirmingPaymentId(client.id);
    try {
      // Calculate new due date based on plan duration
      const plan = client.plans || plans.find((p) => p.id === client.plan_id);
      const durationMonths = plan?.duration_months || 1;
      const newDueDate = new Date();
      newDueDate.setMonth(newDueDate.getMonth() + durationMonths);
      const newDueDateStr = newDueDate.toISOString().split("T")[0];

      // Update client due_date
      await supabase.from("clients").update({ due_date: newDueDateStr }).eq("id", client.id);

      // Send confirmation message
      const updatedClient = { ...client, due_date: newDueDateStr };
      const messageContent = resolveTemplate(confirmTemplate, updatedClient, undefined, undefined, {
        nextDueDate: newDueDateStr,
      });
      await callEvolutionApi("send-bulk", {
        messages: [{ phone: client.phone, message: messageContent, client_id: client.id, template_type: "confirmacao_pagamento" }],
      });

      toast({ title: "Pagamento confirmado!", description: `${client.name} renovado até ${newDueDate.toLocaleDateString("pt-BR")}` });
      fetchData(); // Refresh data
    } catch (err: any) {
      toast({ title: "Erro ao confirmar pagamento", description: err.message, variant: "destructive" });
    }
    setConfirmingPaymentId(null);
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
            const tomorrowClients = clients.filter((c) => c.due_date === tomorrow);
            if (tomorrowClients.length === 0) {
              toast({ title: "Nenhum cliente vencendo amanhã", variant: "destructive" });
              return;
            }
            if (!templateId) {
              toast({ title: "Selecione um template primeiro", variant: "destructive" });
              return;
            }
            setFilter("due_tomorrow");
            setSelected(new Set(tomorrowClients.map((c) => c.id)));
            handleSendBulk(tomorrowClients);
          }}
        >
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span className="font-semibold">Enviar cobrança - Vence Amanhã</span>
          <span className="text-xs text-muted-foreground">
            {clients.filter((c) => c.due_date === tomorrow).length} cliente(s)
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

      {/* Automation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Automação de Cobranças
          </CardTitle>
          <CardDescription>
            Configure o envio automático de mensagens via WhatsApp baseado no vencimento dos clientes. Escolha o horário de envio para cada tipo de cobrança.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-toggle" className="font-medium">
              Ativar envio automático
            </Label>
            <Switch
              id="auto-toggle"
              checked={autoEnabled}
              onCheckedChange={setAutoEnabled}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium text-foreground">Momentos e horários de envio:</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-before"
                checked={autoBeforeDue}
                onCheckedChange={(v) => setAutoBeforeDue(!!v)}
              />
              <Label htmlFor="auto-before" className="text-sm flex-1">1 dia antes do vencimento</Label>
              <Select value={String(hourBeforeDue)} onValueChange={(v) => setHourBeforeDue(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs">vencendo_amanha</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-on"
                checked={autoOnDue}
                onCheckedChange={(v) => setAutoOnDue(!!v)}
              />
              <Label htmlFor="auto-on" className="text-sm flex-1">No dia do vencimento</Label>
              <Select value={String(hourOnDue)} onValueChange={(v) => setHourOnDue(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs">vencendo_hoje</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-after"
                checked={autoAfterDue}
                onCheckedChange={(v) => setAutoAfterDue(!!v)}
              />
              <Label htmlFor="auto-after" className="text-sm flex-1">1 dia após o vencimento</Label>
              <Select value={String(hourAfterDue)} onValueChange={(v) => setHourAfterDue(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs">vencido</Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ Certifique-se de ter templates cadastrados com os tipos <code className="bg-muted px-1 rounded">vencendo_amanha</code>, <code className="bg-muted px-1 rounded">vencendo_hoje</code> e <code className="bg-muted px-1 rounded">vencido</code> para que a automação funcione corretamente.
          </p>

          <Button onClick={handleSaveAutomation} disabled={savingAuto}>
            {savingAuto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Automação
          </Button>

          {hasAutoConfig && (
            <Badge variant={autoEnabled ? "default" : "secondary"} className="ml-2">
              {autoEnabled ? "Automação Ativa" : "Automação Inativa"}
            </Badge>
          )}
        </CardContent>
      </Card>

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
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar cliente por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-48">
              <Select value={filter} onValueChange={(v) => { setFilter(v as FilterType); setSelected(new Set()); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="due_today">Vence Hoje</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="due_tomorrow">Vence Amanhã</SelectItem>
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
                <TableHead className="text-right">Ações</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendingManualId === client.id}
                          onClick={() => handleManualBilling(client)}
                          title="Enviar cobrança manual"
                        >
                          {sendingManualId === client.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Receipt className="mr-1 h-3 w-3" />
                          )}
                          Cobrar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={confirmingPaymentId === client.id}
                          onClick={() => handleConfirmPayment(client)}
                          title="Confirmar pagamento e renovar"
                        >
                          {confirmingPaymentId === client.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 h-3 w-3" />
                          )}
                          Confirmar Pgto
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
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
