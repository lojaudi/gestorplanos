import { useEffect, useState, useCallback, useMemo } from "react";
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
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Client {
  id: string;
  name: string;
  phone: string;
  username: string | null;
  plan_id: string | null;
  service_id: string | null;
  plans: { name: string; price: number | null; duration_months: number } | null;
  services: { name: string } | null;
}

interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  plan_id: string | null;
  amount: number;
  due_date: string;
  status: string;
  description: string;
  payment_date: string | null;
  payment_method: string | null;
  created_at: string;
  clients?: { name: string; phone: string; username: string | null; plan_id: string | null; service_id: string | null } | null;
  plans?: { name: string; price: number | null; duration_months: number } | null;
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

type FilterType = "all" | "due_today" | "overdue" | "pending" | "paid";

export default function Billing() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [templateId, setTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Invoice creation
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceClientId, setInvoiceClientId] = useState("");
  const [invoicePlanId, setInvoicePlanId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Pix
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixInvoice, setPixInvoice] = useState<Invoice | null>(null);
  const [pixAmount, setPixAmount] = useState("");
  const [pixDescription, setPixDescription] = useState("");
  const [generatingPix, setGeneratingPix] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [fixedPixKey, setFixedPixKey] = useState("");

  // Manual billing
  const [sendingManualId, setSendingManualId] = useState<string | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);

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

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [clientsRes, invoicesRes, templatesRes, servicesRes, plansRes] = await Promise.all([
      supabase.from("clients").select("id, name, phone, username, plan_id, service_id, plans(name, price, duration_months), services(name)").eq("user_id", user.id),
      supabase.from("invoices").select("*, clients(name, phone, username, plan_id, service_id), plans(name, price, duration_months)").eq("user_id", user.id).order("due_date", { ascending: true }),
      supabase.from("message_templates").select("*").eq("user_id", user.id),
      supabase.from("services").select("id, name").eq("user_id", user.id),
      supabase.from("plans").select("id, name, price, duration_months").eq("user_id", user.id),
    ]);
    setClients((clientsRes.data as Client[]) || []);
    setInvoices((invoicesRes.data as Invoice[]) || []);
    setTemplates(templatesRes.data || []);
    setServices(servicesRes.data || []);
    setPlans(plansRes.data || []);

    // Check gateway
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
    } catch { /* ignore */ }

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
    } catch { /* ignore */ }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesFilter = (() => {
        switch (filter) {
          case "due_today": return inv.due_date === today && inv.status !== "paid";
          case "overdue": return inv.due_date < today && inv.status !== "paid";
          case "pending": return inv.status === "pending";
          case "paid": return inv.status === "paid";
          default: return true;
        }
      })();
      if (!matchesFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const clientName = inv.clients?.name || "";
      const clientPhone = inv.clients?.phone || "";
      return clientName.toLowerCase().includes(q) || clientPhone.includes(q);
    });
  }, [invoices, filter, searchQuery, today]);

  const stats = useMemo(() => {
    const pending = invoices.filter(i => i.status !== "paid");
    return {
      total: invoices.length,
      dueToday: pending.filter(i => i.due_date === today).length,
      overdue: pending.filter(i => i.due_date < today).length,
      paid: invoices.filter(i => i.status === "paid").length,
    };
  }, [invoices, today]);

  const getInvoiceStatus = (inv: Invoice) => {
    if (inv.status === "paid") return { label: "Pago", variant: "default" as const };
    if (inv.due_date < today) return { label: "Vencido", variant: "destructive" as const };
    if (inv.due_date === today) return { label: "Vence Hoje", variant: "secondary" as const };
    return { label: "Pendente", variant: "outline" as const };
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredInvoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredInvoices.map((i) => i.id)));
    }
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

  const resolveTemplateFromInvoice = (
    template: Template,
    inv: Invoice,
    pixCode?: string,
    paymentLinkId?: string,
    overrides?: {
      dueDate?: string;
      nextDueDate?: string;
      paymentDate?: Date;
    },
  ) => {
    const clientName = inv.clients?.name || "";
    const clientPhone = inv.clients?.phone || "";
    const plan = inv.plans || plans.find(p => p.id === inv.plan_id);
    const planName = plan?.name || "";
    const planPrice = inv.amount > 0 ? inv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : (plan?.price != null ? plan.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
    const resolvedDueDate = overrides?.dueDate ?? inv.due_date;
    const dueDate = new Date(resolvedDueDate + "T12:00:00");
    const formattedDue = dueDate.toLocaleDateString("pt-BR");
    const serviceName = services.find(s => s.id === inv.clients?.service_id)?.name || "";

    const durationMonths = plan?.duration_months || 1;
    const nextDue = overrides?.nextDueDate
      ? new Date(overrides.nextDueDate + "T12:00:00")
      : new Date(dueDate);
    if (!overrides?.nextDueDate) {
      nextDue.setMonth(nextDue.getMonth() + durationMonths);
    }
    const formattedNextDue = nextDue.toLocaleDateString("pt-BR");
    const paymentDate = overrides?.paymentDate ?? new Date();

    const paymentLink = paymentLinkId ? `${window.location.origin}/pay?id=${paymentLinkId}` : (pixCode || "");

    return template.content
      .replace(/{nome}/g, clientName)
      .replace(/{servico}/g, serviceName)
      .replace(/{plano}/g, planName)
      .replace(/{valor_plano}/g, planPrice)
      .replace(/{data_vencimento}/g, formattedDue)
      .replace(/{data_pagamento}/g, paymentDate.toLocaleDateString("pt-BR"))
      .replace(/{proximo_vencimento}/g, formattedNextDue)
      .replace(/{link_pagamento}/g, paymentLink)
      .replace(/{meio_de_pagamento}/g, pixCode || "");
  };

  // Create invoice
  const handleCreateInvoice = async () => {
    if (!user || !invoiceClientId || !invoiceDueDate) return;
    setSavingInvoice(true);
    try {
      const amount = invoiceAmount ? Number(invoiceAmount) : 0;
      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        client_id: invoiceClientId,
        plan_id: invoicePlanId || null,
        amount,
        due_date: invoiceDueDate,
        description: invoiceDescription || "Fatura manual",
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "Fatura criada com sucesso!" });
      setInvoiceDialogOpen(false);
      setInvoiceClientId("");
      setInvoicePlanId("");
      setInvoiceAmount("");
      setInvoiceDueDate("");
      setInvoiceDescription("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao criar fatura", description: err.message, variant: "destructive" });
    }
    setSavingInvoice(false);
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceId) return;
    const { error } = await supabase.from("invoices").delete().eq("id", deleteInvoiceId);
    if (error) {
      toast({ title: "Erro ao excluir fatura", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fatura excluída!" });
      fetchData();
    }
    setDeleteInvoiceId(null);
  };

  // Send billing for selected invoices
  const handleSendBulk = async (overrideInvoices?: Invoice[]) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    const targetInvoices = overrideInvoices || filteredInvoices.filter((i) => selected.has(i.id));
    if (targetInvoices.length === 0) {
      toast({ title: "Selecione pelo menos uma fatura", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const messages = [];
      for (const inv of targetInvoices) {
        const clientPhone = inv.clients?.phone;
        if (!clientPhone) continue;

        let pixCode = "";
        let paymentLinkId = "";

        const hasMeioPagamento = template.content.includes("{meio_de_pagamento}");
        const hasLinkPagamento = template.content.includes("{link_pagamento}");
        const needsMpPix = (hasMeioPagamento || hasLinkPagamento) && gatewayEnabled;
        const useFixedPix = (hasMeioPagamento || hasLinkPagamento) && !gatewayEnabled && !!fixedPixKey;

        if (needsMpPix) {
          const amount = inv.amount > 0 ? inv.amount : (inv.plans?.price || 0);
          if (amount > 0) {
            try {
              const pixResult = await callMercadoPago("create-payment", {
                client_id: inv.client_id,
                amount,
                description: `Cobrança - ${inv.clients?.name}`,
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
        } else if (useFixedPix) {
          pixCode = fixedPixKey;
        }

        messages.push({
          phone: clientPhone,
          message: resolveTemplateFromInvoice(template, inv, pixCode, paymentLinkId),
          client_id: inv.client_id,
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

  // Manual billing for one invoice
  const handleManualBilling = async (inv: Invoice) => {
    const manualTemplate = templates.find((t) => t.type === "cobranca_manual");
    if (!manualTemplate) {
      toast({
        title: "Template não encontrado",
        description: "Crie um template do tipo 'Cobrança Manual' na página de Templates.",
        variant: "destructive",
      });
      return;
    }
    setSendingManualId(inv.id);
    try {
      let pixCode = "";
      let paymentLinkId = "";
      if (gatewayEnabled) {
        const amount = inv.amount > 0 ? inv.amount : (inv.plans?.price || 0);
        if (amount > 0) {
          try {
            const pixResult = await callMercadoPago("create-payment", {
              client_id: inv.client_id,
              amount,
              description: `Cobrança Manual - ${inv.clients?.name}`,
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

      const messageContent = resolveTemplateFromInvoice(manualTemplate, inv, pixCode, paymentLinkId);
      await callEvolutionApi("send-bulk", {
        messages: [{ phone: inv.clients?.phone, message: messageContent, client_id: inv.client_id, template_type: "cobranca_manual" }],
      });
      toast({ title: "Cobrança enviada!", description: `Mensagem enviada para ${inv.clients?.name}` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar cobrança", description: err.message, variant: "destructive" });
    }
    setSendingManualId(null);
  };

  // Confirm payment for invoice + auto-create next invoice
  const handleConfirmPayment = async (inv: Invoice) => {
    const confirmTemplate = templates.find((t) => t.type === "confirmacao_pagamento");
    if (!confirmTemplate) {
      toast({
        title: "Template não encontrado",
        description: "Crie um template do tipo 'Confirmação de Pagamento' na página de Templates.",
        variant: "destructive",
      });
      return;
    }
    setConfirmingPaymentId(inv.id);
    try {
      const paymentConfirmationDate = new Date();

      // Mark invoice as paid
      await supabase.from("invoices").update({
        status: "paid",
        payment_date: paymentConfirmationDate.toISOString(),
        payment_method: gatewayEnabled ? "mercado_pago" : (fixedPixKey ? "pix_fixo" : "manual"),
      }).eq("id", inv.id);

      // Create next invoice (recurrence)
      const plan = inv.plans || plans.find(p => p.id === inv.plan_id);
      const durationMonths = plan?.duration_months || 1;
      const currentDue = new Date(inv.due_date + "T12:00:00");
      const todayDate = new Date();
      todayDate.setHours(12, 0, 0, 0);
      const baseDate = currentDue < todayDate ? new Date(todayDate) : new Date(currentDue);
      baseDate.setMonth(baseDate.getMonth() + durationMonths);
      const newDueDateStr = baseDate.toISOString().split("T")[0];

      await supabase.from("invoices").insert({
        user_id: user!.id,
        client_id: inv.client_id,
        plan_id: inv.plan_id,
        amount: inv.amount,
        due_date: newDueDateStr,
        description: `Renovação automática`,
        status: "pending",
      });

      // Also update client's due_date for backward compatibility
      await supabase.from("clients").update({ due_date: newDueDateStr }).eq("id", inv.client_id);

      // Send confirmation message with the exact renewed due date,
      // avoiding any double calculation of {proximo_vencimento}.
      const messageContent = resolveTemplateFromInvoice(confirmTemplate, inv, undefined, undefined, {
        nextDueDate: newDueDateStr,
        paymentDate: paymentConfirmationDate,
      });
      await callEvolutionApi("send-bulk", {
        messages: [{ phone: inv.clients?.phone, message: messageContent, client_id: inv.client_id, template_type: "confirmacao_pagamento" }],
      });

      toast({ title: "Pagamento confirmado!", description: `Próximo vencimento: ${new Date(newDueDateStr + "T12:00:00").toLocaleDateString("pt-BR")}` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao confirmar pagamento", description: err.message, variant: "destructive" });
    }
    setConfirmingPaymentId(null);
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
        await supabase.from("billing_automation_config").update(payload).eq("user_id", user.id);
      } else {
        await supabase.from("billing_automation_config").insert({ user_id: user.id, ...payload });
        setHasAutoConfig(true);
      }
      toast({ title: "Configuração de automação salva!" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
    setSavingAuto(false);
  };

  const handleGeneratePix = async () => {
    if (!pixInvoice || !pixAmount) return;
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
            client_id: pixInvoice.client_id,
            amount: Number(pixAmount),
            description: pixDescription || `Cobrança - ${pixInvoice.clients?.name}`,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao gerar Pix");

      if (result.success === false) {
        const fallbackKey = result.fallback_pix_key || fixedPixKey;
        if (fallbackKey) {
          await navigator.clipboard.writeText(fallbackKey);
          toast({ title: "Mercado Pago indisponível. Chave Pix fixa copiada." });
        } else {
          toast({ title: result.error || "Erro ao gerar Pix", variant: "destructive" });
        }
      } else {
        const paymentUrl = `${window.location.origin}/pay?id=${result.payment_link_id}`;
        await navigator.clipboard.writeText(paymentUrl);
        toast({ title: "Link Pix gerado e copiado!" });
      }
      setPixDialogOpen(false);
      setPixAmount("");
      setPixDescription("");
    } catch (err: any) {
      if (fixedPixKey) {
        await navigator.clipboard.writeText(fixedPixKey);
        toast({ title: "Mercado Pago indisponível. Chave Pix fixa copiada." });
        setPixDialogOpen(false);
      } else {
        toast({ title: err.message, variant: "destructive" });
      }
    }
    setGeneratingPix(false);
  };

  // Auto-fill amount when client/plan changes in invoice dialog
  const handleInvoiceClientChange = (clientId: string) => {
    setInvoiceClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client?.plan_id) {
      setInvoicePlanId(client.plan_id);
      const plan = plans.find(p => p.id === client.plan_id);
      if (plan?.price) setInvoiceAmount(String(plan.price));
      if (plan) {
        const d = new Date();
        d.setMonth(d.getMonth() + plan.duration_months);
        setInvoiceDueDate(d.toISOString().split("T")[0]);
      }
    }
  };

  const handleInvoicePlanChange = (planId: string) => {
    setInvoicePlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan?.price) setInvoiceAmount(String(plan.price));
    if (plan) {
      const d = new Date();
      d.setMonth(d.getMonth() + plan.duration_months);
      setInvoiceDueDate(d.toISOString().split("T")[0]);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Faturamento
          </h1>
          <p className="text-muted-foreground">
            Gerencie faturas e cobranças dos seus clientes
          </p>
        </div>
        <Button onClick={() => {
          setInvoiceClientId("");
          setInvoicePlanId("");
          setInvoiceAmount("");
          setInvoiceDueDate(new Date().toISOString().split("T")[0]);
          setInvoiceDescription("");
          setInvoiceDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Fatura
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="cursor-pointer" onClick={() => setFilter("all")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total de Faturas</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("due_today")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Vence Hoje</p>
              <p className="text-lg font-bold">{stats.dueToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("overdue")}>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-lg font-bold">{stats.overdue}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("paid")}>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pagas</p>
              <p className="text-lg font-bold">{stats.paid}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Faturas</TabsTrigger>
          <TabsTrigger value="send">Disparar Cobranças</TabsTrigger>
          <TabsTrigger value="automation">Automação</TabsTrigger>
        </TabsList>

        {/* INVOICES TAB */}
        <TabsContent value="invoices" className="space-y-4">
          {/* Payment Method Indicator */}
          <div className={`flex items-center gap-3 rounded-lg border p-3 ${
            gatewayEnabled ? "border-green-500/30 bg-green-500/5" : fixedPixKey ? "border-yellow-500/30 bg-yellow-500/5" : "border-muted bg-muted/30"
          }`}>
            {gatewayEnabled ? (
              <>
                <QrCode className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Mercado Pago ativo</p>
                  <p className="text-xs text-muted-foreground">Cobranças Pix geradas automaticamente</p>
                </div>
                <Badge variant="default" className="ml-auto bg-green-600 hover:bg-green-600">MP Ativo</Badge>
              </>
            ) : fixedPixKey ? (
              <>
                <QrCode className="h-5 w-5 text-yellow-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Chave Pix fixa</p>
                  <p className="text-xs text-muted-foreground">Chave: <code className="bg-muted px-1 rounded text-xs">{fixedPixKey}</code></p>
                </div>
                <Badge variant="secondary" className="ml-auto">Pix Fixo</Badge>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Sem meio de pagamento</p>
                  <p className="text-xs text-muted-foreground">Configure no Gateway de Pagamento</p>
                </div>
                <Badge variant="outline" className="ml-auto">Inativo</Badge>
              </>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v as FilterType); setSelected(new Set()); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="due_today">Vence Hoje</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredInvoices.length > 0 && selected.size === filteredInvoices.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Nenhuma fatura encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const status = getInvoiceStatus(inv);
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              {inv.clients?.name || "—"}
                              {inv.description && <span className="block text-xs text-muted-foreground truncate max-w-[200px]">{inv.description}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{inv.plans?.name || "—"}</TableCell>
                          <TableCell>
                            {inv.amount > 0
                              ? `R$ ${inv.amount.toFixed(2).replace(".", ",")}`
                              : "—"}
                          </TableCell>
                          <TableCell>{new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 flex-wrap">
                              {inv.status !== "paid" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={sendingManualId === inv.id}
                                    onClick={() => handleManualBilling(inv)}
                                    title="Enviar cobrança"
                                  >
                                    {sendingManualId === inv.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Receipt className="mr-1 h-3 w-3" />}
                                    Cobrar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={confirmingPaymentId === inv.id}
                                    onClick={() => handleConfirmPayment(inv)}
                                    title="Confirmar pagamento"
                                  >
                                    {confirmingPaymentId === inv.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                                    Confirmar
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => setDeleteInvoiceId(inv.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEND TAB */}
        <TabsContent value="send" className="space-y-4">
          {/* Quick Send Buttons */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 p-4 border-yellow-500/30 hover:bg-yellow-500/10"
              disabled={sending || !templateId}
              onClick={() => {
                const todayInvoices = invoices.filter(i => i.due_date === today && i.status !== "paid");
                if (todayInvoices.length === 0) { toast({ title: "Nenhuma fatura vencendo hoje", variant: "destructive" }); return; }
                if (!templateId) { toast({ title: "Selecione um template primeiro", variant: "destructive" }); return; }
                handleSendBulk(todayInvoices);
              }}
            >
              <Clock className="h-5 w-5 text-yellow-500" />
              <span className="font-semibold">Cobrar - Vencendo hoje</span>
              <span className="text-xs text-muted-foreground">{stats.dueToday} fatura(s)</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 p-4 border-orange-500/30 hover:bg-orange-500/10"
              disabled={sending || !templateId}
              onClick={() => {
                const tomorrowInvoices = invoices.filter(i => i.due_date === tomorrow && i.status !== "paid");
                if (tomorrowInvoices.length === 0) { toast({ title: "Nenhuma fatura vencendo amanhã", variant: "destructive" }); return; }
                if (!templateId) { toast({ title: "Selecione um template primeiro", variant: "destructive" }); return; }
                handleSendBulk(tomorrowInvoices);
              }}
            >
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="font-semibold">Cobrar - Vence Amanhã</span>
              <span className="text-xs text-muted-foreground">{invoices.filter(i => i.due_date === tomorrow && i.status !== "paid").length} fatura(s)</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 p-4 border-destructive/30 hover:bg-destructive/10"
              disabled={sending || !templateId}
              onClick={() => {
                const overdueInvoices = invoices.filter(i => i.due_date < today && i.status !== "paid");
                if (overdueInvoices.length === 0) { toast({ title: "Nenhuma fatura vencida", variant: "destructive" }); return; }
                if (!templateId) { toast({ title: "Selecione um template primeiro", variant: "destructive" }); return; }
                handleSendBulk(overdueInvoices);
              }}
            >
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold">Cobrar - Vencidas</span>
              <span className="text-xs text-muted-foreground">{stats.overdue} fatura(s)</span>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Disparar Mensagens</CardTitle>
              <CardDescription>Selecione template e faturas para enviar cobranças</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-48">
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleSendBulk()} disabled={sending || selected.size === 0 || !templateId}>
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                  Enviar ({selected.size})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUTOMATION TAB */}
        <TabsContent value="automation">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Automação de Cobranças
              </CardTitle>
              <CardDescription>
                Configure o envio automático de mensagens via WhatsApp baseado no vencimento das faturas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-toggle" className="font-medium">Ativar envio automático</Label>
                <Switch id="auto-toggle" checked={autoEnabled} onCheckedChange={setAutoEnabled} />
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium text-foreground">Momentos e horários de envio:</p>
                <div className="flex items-center gap-2">
                  <Checkbox id="auto-before" checked={autoBeforeDue} onCheckedChange={(v) => setAutoBeforeDue(!!v)} />
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
                  <Checkbox id="auto-on" checked={autoOnDue} onCheckedChange={(v) => setAutoOnDue(!!v)} />
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
                  <Checkbox id="auto-after" checked={autoAfterDue} onCheckedChange={(v) => setAutoAfterDue(!!v)} />
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
                ⚠️ Certifique-se de ter templates cadastrados com os tipos <code className="bg-muted px-1 rounded">vencendo_amanha</code>, <code className="bg-muted px-1 rounded">vencendo_hoje</code> e <code className="bg-muted px-1 rounded">vencido</code>.
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
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Fatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={invoiceClientId} onValueChange={handleInvoiceClientChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={invoicePlanId} onValueChange={handleInvoicePlanChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — R$ {p.price?.toFixed(2).replace(".", ",") || "0,00"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={invoiceDescription} onChange={(e) => setInvoiceDescription(e.target.value)} placeholder="Ex: Mensalidade Março" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateInvoice} disabled={!invoiceClientId || !invoiceDueDate || savingInvoice}>
              {savingInvoice ? "Salvando..." : "Criar Fatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Confirmation */}
      <AlertDialog open={!!deleteInvoiceId} onOpenChange={() => setDeleteInvoiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pix Generation Dialog */}
      <Dialog open={pixDialogOpen} onOpenChange={setPixDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cobrança Pix</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{pixInvoice?.clients?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="pix-amount">Valor (R$)</Label>
              <Input id="pix-amount" type="number" step="0.01" min="0.01" placeholder="0,00" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix-desc">Descrição (opcional)</Label>
              <Input id="pix-desc" placeholder="Ex: Mensalidade Janeiro" value={pixDescription} onChange={(e) => setPixDescription(e.target.value)} />
            </div>
            <Button className="w-full" disabled={generatingPix || !pixAmount} onClick={handleGeneratePix}>
              {generatingPix ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Gerar e Copiar Link Pix
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
