import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildLegacyPaidEntries, type ClientRevenueSnapshot } from "@/lib/financial-history";
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
import { Search, FileText, DollarSign, AlertTriangle, Clock, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function Reports() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    switch (preset) {
      case "all":
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
      case "this_month":
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case "last_month":
        setDateFrom(startOfMonth(subMonths(now, 1)));
        setDateTo(endOfMonth(subMonths(now, 1)));
        break;
      case "this_quarter":
        setDateFrom(startOfQuarter(now));
        setDateTo(endOfQuarter(now));
        break;
      case "last_quarter":
        setDateFrom(startOfQuarter(subMonths(now, 3)));
        setDateTo(endOfQuarter(subMonths(now, 3)));
        break;
      case "custom":
        break;
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: invoiceRows }, { data: clientRows }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, amount, due_date, payment_date, status, client_id, created_at")
          .eq("user_id", user.id),
        supabase
          .from("clients")
          .select("id, name, created_at, due_date, plan_id, plans(price, duration_months)")
          .eq("user_id", user.id),
      ]);

      const clients = (clientRows as ClientReportSnapshot[] | null) ?? [];
      const clientMap = new Map(clients.map((client) => [client.id, client.name]));
      const invoicesData = invoiceRows ?? [];
      const migrationDate = invoicesData.length > 0
        ? new Date(Math.min(...invoicesData.map((invoice) => new Date(invoice.created_at).getTime())))
        : new Date();

      const legacyPaidEntries = buildLegacyPaidEntries(clients, migrationDate);

      const history = [
        ...legacyPaidEntries,
        ...invoicesData.map((inv) => ({
          id: inv.id,
          amount: Number(inv.amount),
          due_date: inv.due_date,
          payment_date: inv.payment_date,
          status: inv.status,
          client_name: clientMap.get(inv.client_id) ?? "—",
        })),
      ].sort((a, b) => {
        const dateA = new Date(a.payment_date ?? `${a.due_date}T12:00:00`).getTime();
        const dateB = new Date(b.payment_date ?? `${b.due_date}T12:00:00`).getTime();
        return dateB - dateA;
      });

      setInvoices(history);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    let list = invoices;

    // Filter by status tab
    if (tab === "paid") list = list.filter((i) => i.status === "paid");
    else if (tab === "overdue") list = list.filter((i) => i.status === "overdue");
    else if (tab === "pending") list = list.filter((i) => i.status === "pending");

    // Filter by date range
    if (dateFrom || dateTo) {
      list = list.filter((i) => {
        const refDate = new Date(i.payment_date ?? `${i.due_date}T12:00:00`);
        if (dateFrom && refDate < dateFrom) return false;
        if (dateTo && refDate > new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59)) return false;
        return true;
      });
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.client_name.toLowerCase().includes(q));
    }
    return list;
  }, [invoices, tab, search, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const paid = filtered.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const overdue = filtered.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
    const pending = filtered.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
    return { paid, overdue, pending, all: paid + overdue + pending };
  }, [filtered]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtDate = (d: string | null) =>
    d ? new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "—";

  const fmtDateBtn = (d: Date | undefined) =>
    d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar";

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Pago</Badge>;
    if (s === "overdue") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Atrasado</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Acompanhe todos os pagamentos dos seus clientes</p>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">Filtrar por período</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
              <Select value={periodPreset} onValueChange={(v) => handlePresetChange(v as PeriodPreset)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
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
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fmtDateBtn(dateFrom)}
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
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fmtDateBtn(dateTo)}
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
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome do cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
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
                    {filtered.map((inv) => (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
