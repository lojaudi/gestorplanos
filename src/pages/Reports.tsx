import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildLegacyPaidEntries, getMonthKey, formatMonthLabel, type ClientRevenueSnapshot } from "@/lib/financial-history";
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, FileText, DollarSign, AlertTriangle, Clock, CalendarIcon, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InvoiceReport {
  id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  client_name: string;
}

interface ClientReportSnapshot extends ClientRevenueSnapshot {
  name: string;
}

type PeriodPreset = "all" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "custom";

const ITEMS_PER_PAGE = 20;

const statusLabel = (s: string) => {
  if (s === "paid") return "Pago";
  if (s === "overdue") return "Atrasado";
  return "Pendente";
};

export default function Reports() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    setPage(1);
    const now = new Date();
    switch (preset) {
      case "all": setDateFrom(undefined); setDateTo(undefined); break;
      case "this_month": setDateFrom(startOfMonth(now)); setDateTo(endOfMonth(now)); break;
      case "last_month": setDateFrom(startOfMonth(subMonths(now, 1))); setDateTo(endOfMonth(subMonths(now, 1))); break;
      case "this_quarter": setDateFrom(startOfQuarter(now)); setDateTo(endOfQuarter(now)); break;
      case "last_quarter": setDateFrom(startOfQuarter(subMonths(now, 3))); setDateTo(endOfQuarter(subMonths(now, 3))); break;
      case "custom": break;
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: invoiceRows }, { data: clientRows }] = await Promise.all([
        supabase.from("invoices").select("id, amount, due_date, payment_date, status, client_id, created_at").eq("user_id", user.id),
        supabase.from("clients").select("id, name, created_at, due_date, plan_id, plans(price, duration_months)").eq("user_id", user.id),
      ]);

      const clients = (clientRows as ClientReportSnapshot[] | null) ?? [];
      const clientMap = new Map(clients.map((c) => [c.id, c.name]));
      const invoicesData = invoiceRows ?? [];
      const migrationDate = invoicesData.length > 0
        ? new Date(Math.min(...invoicesData.map((i) => new Date(i.created_at).getTime())))
        : new Date();

      const legacyPaidEntries = buildLegacyPaidEntries(clients, migrationDate);

      const history = [
        ...legacyPaidEntries,
        ...invoicesData.map((inv) => ({
          id: inv.id, amount: Number(inv.amount), due_date: inv.due_date,
          payment_date: inv.payment_date, status: inv.status,
          client_name: clientMap.get(inv.client_id) ?? "—",
        })),
      ].sort((a, b) => {
        const dA = new Date(a.payment_date ?? `${a.due_date}T12:00:00`).getTime();
        const dB = new Date(b.payment_date ?? `${b.due_date}T12:00:00`).getTime();
        return dB - dA;
      });

      setInvoices(history);
      setLoading(false);
    })();
  }, [user]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [tab, search, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (tab === "paid") list = list.filter((i) => i.status === "paid");
    else if (tab === "overdue") list = list.filter((i) => i.status === "overdue");
    else if (tab === "pending") list = list.filter((i) => i.status === "pending");

    if (dateFrom || dateTo) {
      list = list.filter((i) => {
        const refDate = new Date(i.payment_date ?? `${i.due_date}T12:00:00`);
        if (dateFrom && refDate < dateFrom) return false;
        if (dateTo && refDate > new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59)) return false;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.client_name.toLowerCase().includes(q));
    }
    return list;
  }, [invoices, tab, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const totals = useMemo(() => {
    const paid = filtered.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const overdue = filtered.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
    const pending = filtered.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
    return { paid, overdue, pending, all: paid + overdue + pending };
  }, [filtered]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, { received: number; pending: number; overdue: number }> = {};
    for (const inv of filtered) {
      const refDate = new Date(inv.payment_date ?? `${inv.due_date}T12:00:00`);
      const key = getMonthKey(refDate);
      if (!byMonth[key]) byMonth[key] = { received: 0, pending: 0, overdue: 0 };
      if (inv.status === "paid") byMonth[key].received += inv.amount;
      else if (inv.status === "overdue") byMonth[key].overdue += inv.amount;
      else byMonth[key].pending += inv.amount;
    }
    return Object.keys(byMonth)
      .sort()
      .map((key) => ({
        name: formatMonthLabel(key),
        Recebido: byMonth[key].received,
        Pendente: byMonth[key].pending,
        Atrasado: byMonth[key].overdue,
      }));
  }, [filtered]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: string | null) => d ? new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "—";
  const fmtDateBtn = (d: Date | undefined) => d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar";

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Pago</Badge>;
    if (s === "overdue") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Atrasado</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pendente</Badge>;
  };

  const exportCSV = useCallback(() => {
    if (filtered.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const header = "Cliente;Vencimento;Pagamento;Valor;Status";
    const rows = filtered.map((i) =>
      `"${i.client_name}";"${fmtDate(i.due_date)}";"${fmtDate(i.payment_date)}";"${fmt(i.amount)}";"${statusLabel(i.status)}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  }, [filtered]);

  const exportPDF = useCallback(() => {
    if (filtered.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const printWin = window.open("", "_blank");
    if (!printWin) { toast.error("Permita pop-ups para exportar PDF"); return; }

    const rows = filtered.map((i) =>
      `<tr><td>${i.client_name}</td><td>${fmtDate(i.due_date)}</td><td>${fmtDate(i.payment_date)}</td><td>${fmt(i.amount)}</td><td>${statusLabel(i.status)}</td></tr>`
    ).join("");

    printWin.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;margin-bottom:4px}
      p{color:#666;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      .summary{display:flex;gap:24px;margin-bottom:16px;font-size:13px}
      .summary span{font-weight:600}
      @media print{body{padding:0}}</style></head><body>
      <h1>Relatório Financeiro</h1>
      <p>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
      <div class="summary">
        <div>Total Geral: <span>${fmt(totals.all)}</span></div>
        <div>Recebidos: <span style="color:green">${fmt(totals.paid)}</span></div>
        <div>Atrasados: <span style="color:red">${fmt(totals.overdue)}</span></div>
        <div>A Receber: <span style="color:orange">${fmt(totals.pending)}</span></div>
      </div>
      <table><thead><tr><th>Cliente</th><th>Vencimento</th><th>Pagamento</th><th>Valor</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 500);
    toast.success("PDF pronto para impressão!");
  }, [filtered, totals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Acompanhe todos os pagamentos dos seus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">Filtrar por período</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
              <Select value={periodPreset} onValueChange={(v) => handlePresetChange(v as PeriodPreset)}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="this_month">Este mês</SelectItem>
                  <SelectItem value="last_month">Mês passado</SelectItem>
                  <SelectItem value="this_quarter">Este trimestre</SelectItem>
                  <SelectItem value="last_quarter">Trimestre passado</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {periodPreset === "custom" && (
                <div className="flex gap-2 items-center flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{fmtDateBtn(dateFrom)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPeriodPreset("custom"); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-sm">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{fmtDateBtn(dateTo)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPeriodPreset("custom"); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Geral</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totals.all)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebidos</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-emerald-600">{fmt(totals.paid)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Atrasados</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-red-600">{fmt(totals.overdue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-amber-600">{fmt(totals.pending)}</p></CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por nome do cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="paid">Recebidos</TabsTrigger>
          <TabsTrigger value="overdue">Atrasados</TabsTrigger>
          <TabsTrigger value="pending">A Receber</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum registro encontrado</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.client_name}</TableCell>
                          <TableCell>{fmtDate(inv.due_date)}</TableCell>
                          <TableCell>{fmtDate(inv.payment_date)}</TableCell>
                          <TableCell>{fmt(inv.amount)}</TableCell>
                          <TableCell>{statusBadge(inv.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) { pageNum = i + 1; }
                          else if (page <= 3) { pageNum = i + 1; }
                          else if (page >= totalPages - 2) { pageNum = totalPages - 4 + i; }
                          else { pageNum = page - 2 + i; }
                          return (
                            <Button key={pageNum} variant={pageNum === page ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setPage(pageNum)}>
                              {pageNum}
                            </Button>
                          );
                        })}
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
