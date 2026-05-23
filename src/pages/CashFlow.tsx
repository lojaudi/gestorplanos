import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCashflowAccess } from "@/hooks/useCashflowAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Crown, Tags, RefreshCw } from "lucide-react";

interface Entry {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  entry_date: string;
  source?: "manual" | "invoice" | "payment_link";
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
}

const todayBRT = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return d.toISOString().slice(0, 10);
};

const defaultForm = {
  type: "income" as "income" | "expense",
  amount: "",
  currency: "BRL" as "BRL" | "USD" | "EUR",
  description: "",
  category: "",
  entry_date: todayBRT(),
  is_recurring: false,
};

const addMonthsClamped = (iso: string, months: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const ty = target.getFullYear();
  const tm = target.getMonth();
  const lastDay = new Date(ty, tm + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${ty}-${String(tm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const monthsBetween = (fromIso: string, toIso: string) => {
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

type Rates = { USD: number; EUR: number };
let ratesCache: { at: number; data: Rates } | null = null;

const fetchRates = async (): Promise<Rates> => {
  if (ratesCache && Date.now() - ratesCache.at < 10 * 60 * 1000) return ratesCache.data;
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL");
  if (!res.ok) throw new Error("Falha ao obter cotação");
  const j = await res.json();
  const data: Rates = {
    USD: parseFloat(j?.USDBRL?.bid ?? "0"),
    EUR: parseFloat(j?.EURBRL?.bid ?? "0"),
  };
  if (!data.USD || !data.EUR) throw new Error("Cotação indisponível");
  ratesCache = { at: Date.now(), data };
  return data;
};

const ConversionPreview = ({ amount, currency }: { amount: number; currency: "USD" | "EUR" }) => {
  const [rate, setRate] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setErr(false);
    fetchRates()
      .then((r) => alive && setRate(r[currency]))
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [currency]);
  if (err) return <p className="text-xs text-destructive">Falha ao obter cotação.</p>;
  if (!rate) return <p className="text-xs text-muted-foreground">Obtendo cotação...</p>;
  const brl = amount * rate;
  return (
    <p className="text-xs text-muted-foreground">
      ≈ {brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (cotação: R$ {rate.toLocaleString("pt-BR", { minimumFractionDigits: 4 })})
    </p>
  );
};



const PAGE_SIZE = 20;

const CashFlow = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { enabled, loading: accessLoading } = useCashflowAccess();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [recalculating, setRecalculating] = useState(false);

  // categories management
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", type: "income" as "income" | "expense" });
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  const ensureRecurring = async () => {
    if (!user) return;
    const { data: templates } = await supabase
      .from("cash_flow_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_recurring", true);
    if (!templates || templates.length === 0) return;

    const today = todayBRT();
    const toInsert: any[] = [];

    for (const t of templates as any[]) {
      const anchor: string = t.entry_date;
      const diff = monthsBetween(anchor, today);
      if (diff <= 0) continue;

      const { data: existingChildren } = await supabase
        .from("cash_flow_entries")
        .select("entry_date")
        .eq("user_id", user.id)
        .eq("recurrence_parent_id", t.id);
      const existing = new Set(((existingChildren as any[]) || []).map((c) => c.entry_date));

      for (let i = 1; i <= diff; i++) {
        const date = addMonthsClamped(anchor, i);
        if (existing.has(date)) continue;
        toInsert.push({
          user_id: user.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          category: t.category,
          entry_date: date,
          recurrence_parent_id: t.id,
          is_recurring: false,
        });
      }
    }
    if (toInsert.length) {
      await supabase.from("cash_flow_entries").insert(toInsert);
    }
  };

  const fetchAll = async (notify = false) => {
    if (!user) return;
    await ensureRecurring();
    const [
      { data: entriesData },
      { data: catData },
      { data: paidInvoices },
      { data: paidLinks },
    ] = await Promise.all([
      supabase.from("cash_flow_entries").select("*").eq("user_id", user.id)
        .order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("cash_flow_categories").select("*").eq("user_id", user.id).order("name"),
      supabase.from("invoices")
        .select("id, amount, description, payment_date, due_date, payment_method, clients(name)")
        .eq("user_id", user.id).eq("status", "paid"),
      supabase.from("payment_links")
        .select("id, amount, description, created_at, clients(name)")
        .eq("user_id", user.id).eq("status", "paid"),
    ]);

    const manual: Entry[] = ((entriesData as any[]) || []).map((e) => ({
      ...e,
      source: "manual" as const,
    }));

    const invoiceEntries: Entry[] = ((paidInvoices as any[]) || []).map((inv) => {
      const dateRef = inv.payment_date ? String(inv.payment_date).slice(0, 10) : inv.due_date;
      const clientName = inv.clients?.name ? ` — ${inv.clients.name}` : "";
      const desc = (inv.description && inv.description.trim()) || "Fatura paga";
      return {
        id: `invoice:${inv.id}`,
        type: "income",
        amount: Number(inv.amount),
        description: `${desc}${clientName}`,
        category: "Faturamento",
        entry_date: dateRef,
        source: "invoice" as const,
      };
    });


    const linkEntries: Entry[] = ((paidLinks as any[]) || []).map((l) => {
      const dateRef = String(l.created_at).slice(0, 10);
      const clientName = l.clients?.name ? ` — ${l.clients.name}` : "";
      const desc = (l.description && l.description.trim()) || "Link de pagamento";
      return {
        id: `link:${l.id}`,
        type: "income",
        amount: Number(l.amount),
        description: `${desc}${clientName}`,
        category: "Faturamento",
        entry_date: dateRef,
        source: "payment_link" as const,
      };
    });

    const all = [...manual, ...invoiceEntries, ...linkEntries].sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
    );

    setEntries(all);
    setCategories((catData as Category[]) || []);
    setLoading(false);

    if (notify) {
      const total = invoiceEntries.length + linkEntries.length;
      const sum = [...invoiceEntries, ...linkEntries].reduce((s, e) => s + e.amount, 0);
      toast({
        title: "Fluxo de caixa recalculado",
        description: `${total} recebimento(s) de faturamento sincronizado(s) — total ${sum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      });
    }
  };

  useEffect(() => {
    if (enabled && user) fetchAll();
  }, [enabled, user]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.type !== filter) return false;
      if (categoryFilter !== "all") {
        if (categoryFilter === "__none__") {
          if (e.category && e.category.trim() !== "") return false;
        } else if ((e.category ?? "") !== categoryFilter) {
          return false;
        }
      }
      if (search && !`${e.description} ${e.category ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filter, categoryFilter, search]);

  const availableCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => {
      if (filter === "all" || c.type === filter) set.add(c.name);
    });
    entries.forEach((e) => {
      if (e.category && (filter === "all" || e.type === filter)) set.add(e.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, entries, filter]);

  const totals = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    let income = 0, expense = 0, monthIncome = 0, monthExpense = 0;
    for (const e of entries) {
      const d = new Date(e.entry_date + "T00:00:00");
      const inMonth = d.getMonth() === m && d.getFullYear() === y;
      if (e.type === "income") {
        income += Number(e.amount);
        if (inMonth) monthIncome += Number(e.amount);
      } else {
        expense += Number(e.amount);
        if (inMonth) monthExpense += Number(e.amount);
      }
    }
    return { income, expense, monthIncome, monthExpense, balance: income - expense };
  }, [entries]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === form.type),
    [categories, form.type],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm({
      type: e.type,
      amount: String(e.amount),
      currency: "BRL",
      description: e.description,
      category: e.category ?? "",
      entry_date: e.entry_date,
    });

    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: "Descrição obrigatória", variant: "destructive" });
      return;
    }
    setSaving(true);
    let amountBRL = amount;
    let description = form.description.trim();
    if (form.currency !== "BRL") {
      try {
        const rates = await fetchRates();
        const rate = rates[form.currency];
        amountBRL = Math.round(amount * rate * 100) / 100;
        const symbol = form.currency === "USD" ? "US$" : "€";
        description += ` (${symbol} ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} @ R$ ${rate.toLocaleString("pt-BR", { minimumFractionDigits: 4 })})`;
      } catch (err: any) {
        setSaving(false);
        toast({ title: "Erro ao obter cotação", description: "Tente novamente ou informe o valor em Reais.", variant: "destructive" });
        return;
      }
    }
    const payload = {
      user_id: user.id,
      type: form.type,
      amount: amountBRL,
      description,
      category: form.category.trim() || null,
      entry_date: form.entry_date,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("cash_flow_entries").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Lançamento atualizado!" });
      } else {
        const { error } = await supabase.from("cash_flow_entries").insert(payload);
        if (error) throw error;
        toast({ title: "Lançamento criado!" });
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("cash_flow_entries").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento excluído!" });
      fetchAll();
    }
    setDeleteId(null);
  };

  // Categories CRUD
  const openCatCreate = () => {
    setEditingCat(null);
    setCatForm({ name: "", type: "income" });
  };

  const openCatEdit = (c: Category) => {
    setEditingCat(c);
    setCatForm({ name: c.name, type: c.type });
  };

  const handleSaveCategory = async () => {
    if (!user) return;
    const name = catForm.name.trim();
    if (!name) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSavingCat(true);
    try {
      if (editingCat) {
        const { error } = await supabase.from("cash_flow_categories")
          .update({ name, type: catForm.type })
          .eq("id", editingCat.id);
        if (error) throw error;
        toast({ title: "Categoria atualizada!" });
      } else {
        const { error } = await supabase.from("cash_flow_categories")
          .insert({ user_id: user.id, name, type: catForm.type });
        if (error) throw error;
        toast({ title: "Categoria criada!" });
      }
      setEditingCat(null);
      setCatForm({ name: "", type: catForm.type });
      fetchAll();
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message?.includes("duplicate") ? "Já existe uma categoria com esse nome e tipo." : err.message,
        variant: "destructive",
      });
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatId) return;
    const { error } = await supabase.from("cash_flow_categories").delete().eq("id", deleteCatId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Categoria excluída!" });
      fetchAll();
    }
    setDeleteCatId(null);
  };

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (accessLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Módulo Fluxo de Caixa</h2>
        <p className="text-muted-foreground mb-6">
          Esta funcionalidade não está incluída no seu plano atual. Faça um upgrade para gerenciar proventos e gastos.
        </p>
        <Button onClick={() => navigate("/subscribe")}>
          <Crown className="mr-2 h-4 w-4" /> Ver Planos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Cadastre proventos e gastos manualmente</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setRecalculating(true);
              try { await fetchAll(true); } finally { setRecalculating(false); }
            }}
            disabled={recalculating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculando..." : "Recalcular"}
          </Button>
          <Button variant="outline" onClick={() => { openCatCreate(); setCatDialogOpen(true); }}>
            <Tags className="mr-2 h-4 w-4" /> Categorias
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Proventos (mês)</span>
            </div>
            <p className="text-xl font-bold">{fmt(totals.monthIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Gastos (mês)</span>
            </div>
            <p className="text-xl font-bold">{fmt(totals.monthExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Proventos total</span>
            </div>
            <p className="text-xl font-bold">{fmt(totals.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saldo total</span>
            </div>
            <p className="text-xl font-bold">{fmt(totals.balance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as any); setCategoryFilter("all"); setPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos os tipos</option>
            <option value="income">Apenas proventos</option>
            <option value="expense">Apenas gastos</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
          >
            <option value="all">Todas as categorias</option>
            <option value="__none__">Sem categoria</option>
            {availableCategoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-[200px]"
          />
          {(filter !== "all" || categoryFilter !== "all" || search) && (
            <Button
              variant="ghost"
              onClick={() => { setFilter("all"); setCategoryFilter("all"); setSearch(""); setPage(1); }}
            >
              Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>
              ) : (
                pageItems.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      {e.type === "income" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Provento</Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20">Gasto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{e.description}</TableCell>
                    <TableCell className="text-muted-foreground">{e.category || "—"}</TableCell>
                    <TableCell className={`text-right font-semibold ${e.type === "income" ? "text-emerald-600" : "text-destructive"}`}>
                      {e.type === "income" ? "+" : "-"} {fmt(Number(e.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {e.source === "manual" || !e.source ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic pr-2">auto</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense", category: "" })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="income">Provento (entrada)</option>
                <option value="expense">Gasto (saída)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0,00"
                    className="flex-1"
                  />
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value as "BRL" | "USD" | "EUR" })}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="BRL">R$</option>
                    <option value="USD">US$</option>
                    <option value="EUR">€</option>
                  </select>
                </div>
                {form.currency !== "BRL" && form.amount && parseFloat(form.amount) > 0 && (
                  <ConversionPreview amount={parseFloat(form.amount)} currency={form.currency} />
                )}
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Aluguel sala comercial"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Sem categoria —</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                {form.category && !filteredCategories.some((c) => c.name === form.category) && (
                  <option value={form.category}>{form.category} (antiga)</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                Gerencie as categorias clicando em "Categorias" no topo da página.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Categorias */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 border rounded-md p-3 bg-muted/30">
            <p className="text-sm font-medium">{editingCat ? "Editar categoria" : "Nova categoria"}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <Input
                placeholder="Nome (ex: Aluguel, Marketing)"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                maxLength={80}
              />
              <select
                value={catForm.type}
                onChange={(e) => setCatForm({ ...catForm, type: e.target.value as "income" | "expense" })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="income">Provento</option>
                <option value="expense">Gasto</option>
              </select>
              <div className="flex gap-2">
                <Button onClick={handleSaveCategory} disabled={savingCat}>
                  {savingCat ? "..." : editingCat ? "Atualizar" : "Adicionar"}
                </Button>
                {editingCat && (
                  <Button variant="outline" onClick={() => { setEditingCat(null); setCatForm({ name: "", type: "income" }); }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nenhuma categoria cadastrada</TableCell></TableRow>
                ) : (
                  categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {c.type === "income" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Provento</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20">Gasto</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openCatEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCatId(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCatId} onOpenChange={() => setDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos existentes manterão o nome da categoria, mas ela não estará mais disponível para seleção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CashFlow;
