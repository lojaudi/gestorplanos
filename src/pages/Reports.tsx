import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildLegacyPaidEntries, type ClientRevenueSnapshot } from "@/lib/financial-history";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, DollarSign, AlertTriangle, Clock } from "lucide-react";

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

export default function Reports() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

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
    if (tab === "paid") list = list.filter((i) => i.status === "paid");
    else if (tab === "overdue") list = list.filter((i) => i.status === "overdue");
    else if (tab === "pending") list = list.filter((i) => i.status === "pending");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.client_name.toLowerCase().includes(q));
    }
    return list;
  }, [invoices, tab, search]);

  const totals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
    const pending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
    return { paid, overdue, pending, all: paid + overdue + pending };
  }, [invoices]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtDate = (d: string | null) =>
    d ? new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "—";

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Pago</Badge>;
    if (s === "overdue") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Atrasado</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pendente</Badge>;
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Acompanhe todos os pagamentos dos seus clientes</p>
        </div>

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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome do cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todos ({invoices.length})</TabsTrigger>
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
    </>
  );
}
