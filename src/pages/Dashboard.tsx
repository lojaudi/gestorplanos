import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTodayBRT } from "@/lib/date-brt";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  CreditCard,
  FileText,
  MessageSquare,
  AlertTriangle,
  Clock,
  Megaphone,
  ArrowRight,
  TrendingUp,
  Activity,
  DollarSign,
  Wallet,
  CalendarCheck,
  BadgeDollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  buildMonthlyFinancialChart,
  calculateLegacyRevenueBreakdown,
  getMonthKey,
  type ClientRevenueSnapshot,
  type MonthlyFinancialPoint,
} from "@/lib/financial-history";

interface Stats {
  totalClients: number;
  totalInvoices: number;
  dueToday: number;
  overdue: number;
  paid: number;
  pending: number;
}

interface FinancialStats {
  totalReceivedAllTime: number;
  totalReceivedMonth: number;
  totalToReceiveMonth: number;
  totalExpensesMonth: number;
  totalExpensesAllTime: number;
}

const sumByMonth = (target: Record<string, number>, monthKey: string, amount: number) => {
  target[monthKey] = (target[monthKey] ?? 0) + amount;
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalClients: 0, totalInvoices: 0, dueToday: 0, overdue: 0, paid: 0, pending: 0 });
  const [financial, setFinancial] = useState<FinancialStats>({
    totalReceivedAllTime: 0,
    totalReceivedMonth: 0,
    totalToReceiveMonth: 0,
    totalExpensesMonth: 0,
    totalExpensesAllTime: 0,
  });
  const [financialChart, setFinancialChart] = useState<MonthlyFinancialPoint[]>([]);

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
}) => (
  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </CardContent>
  </Card>
);

const MoneyCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
}) => (
  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <DollarSign className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <p className="text-2xl font-bold tracking-tight">
        {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </CardContent>
  </Card>
);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const today = getTodayBRT();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentMonthKey = getMonthKey(now);

      const [{ data: clientsDataRaw }, { data: invoicesData }, { data: paidLinks }, { data: cashflowData }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, created_at, due_date, plan_id, plans(price, duration_months)")
          .eq("user_id", user.id),
        supabase
          .from("invoices")
          .select("id, due_date, status, amount, payment_date, created_at")
          .eq("user_id", user.id),
        supabase
          .from("payment_links")
          .select("amount, created_at, status")
          .eq("user_id", user.id)
          .eq("status", "paid"),
        supabase
          .from("cash_flow_entries")
          .select("type, amount, entry_date")
          .eq("user_id", user.id),
      ]);

      const clients = (clientsDataRaw as ClientRevenueSnapshot[] | null) || [];
      const invoices = invoicesData || [];
      const pending = invoices.filter(i => i.status !== "paid");
      const migrationDate = invoices.length > 0
        ? new Date(Math.min(...invoices.map((invoice) => new Date(invoice.created_at).getTime())))
        : now;

      setStats({
        totalClients: clients.length,
        totalInvoices: invoices.length,
        dueToday: pending.filter(i => i.due_date === today).length,
        overdue: pending.filter(i => i.due_date < today).length,
        paid: invoices.filter(i => i.status === "paid").length,
        pending: pending.length,
      });

      const legacyRevenue = calculateLegacyRevenueBreakdown(clients, migrationDate);
      const receivedByMonth = { ...legacyRevenue.byMonth };
      const pendingByMonth: Record<string, number> = {};

      let totalReceivedAllTime = legacyRevenue.total;
      let totalReceivedMonth = legacyRevenue.byMonth[currentMonthKey] ?? 0;
      let totalToReceiveMonth = 0;

      for (const inv of invoices) {
        if (inv.status === "paid") {
          const amount = Number(inv.amount);
          const dateRef = inv.payment_date
            ? new Date(inv.payment_date)
            : new Date(inv.due_date + "T00:00:00");
          const monthKey = getMonthKey(dateRef);

          totalReceivedAllTime += amount;
          sumByMonth(receivedByMonth, monthKey, amount);

          if (dateRef.getMonth() === currentMonth && dateRef.getFullYear() === currentYear) {
            totalReceivedMonth += amount;
          }
        } else {
          const dueDate = new Date(inv.due_date + "T00:00:00");
          const amount = Number(inv.amount);
          sumByMonth(pendingByMonth, getMonthKey(dueDate), amount);

          if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
            totalToReceiveMonth += amount;
          }
        }
      }

      if (paidLinks) {
        for (const link of paidLinks) {
          const amount = Number(link.amount);
          const createdAt = new Date(link.created_at);
          const monthKey = getMonthKey(createdAt);

          totalReceivedAllTime += amount;
          sumByMonth(receivedByMonth, monthKey, amount);

          if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) {
            totalReceivedMonth += amount;
          }
        }
      }

      let totalExpensesMonth = 0;
      let totalExpensesAllTime = 0;
      if (cashflowData) {
        for (const cf of cashflowData) {
          const amount = Number(cf.amount);
          const dateRef = new Date(cf.entry_date + "T00:00:00");
          const monthKey = getMonthKey(dateRef);
          const inMonth = dateRef.getMonth() === currentMonth && dateRef.getFullYear() === currentYear;

          if (cf.type === "income") {
            totalReceivedAllTime += amount;
            sumByMonth(receivedByMonth, monthKey, amount);
            if (inMonth) totalReceivedMonth += amount;
          } else if (cf.type === "expense") {
            totalExpensesAllTime += amount;
            if (inMonth) totalExpensesMonth += amount;
          }
        }
      }

      setFinancial({ totalReceivedAllTime, totalReceivedMonth, totalToReceiveMonth, totalExpensesMonth, totalExpensesAllTime });
      setFinancialChart(buildMonthlyFinancialChart(receivedByMonth, pendingByMonth, currentMonthKey));
    };

    fetchStats();
  }, [user]);

  const quickActions = [
    { icon: Users, label: "Clientes", description: "Gerenciar base", path: "/clients" },
    { icon: CreditCard, label: "Faturamento", description: "Faturas e cobranças", path: "/billing" },
    { icon: Megaphone, label: "Campanhas", description: "Enviar mensagens", path: "/campaign" },
    { icon: FileText, label: "Templates", description: "Modelos de mensagem", path: "/templates" },
    { icon: MessageSquare, label: "WhatsApp", description: "Configurar API", path: "/whatsapp" },
    { icon: Activity, label: "Logs de Envio", description: "Histórico de mensagens", path: "/logs" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do seu negócio</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span>Atualizado agora</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total de Clientes" value={stats.totalClients} accent="bg-primary/10 text-primary" />
        <StatCard icon={FileText} label="Total de Faturas" value={stats.totalInvoices} accent="bg-emerald-500/10 text-emerald-500" />
        <StatCard icon={Clock} label="Vencem Hoje" value={stats.dueToday} accent="bg-amber-500/10 text-amber-500" />
        <StatCard icon={AlertTriangle} label="Vencidas" value={stats.overdue} accent="bg-destructive/10 text-destructive" />
      </div>

      {/* Financial Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyCard
          icon={Wallet}
          label="Total Recebido (Geral)"
          value={financial.totalReceivedAllTime}
          accent="bg-emerald-500/10 text-emerald-500"
        />
        <MoneyCard
          icon={CalendarCheck}
          label="Recebido este Mês"
          value={financial.totalReceivedMonth}
          accent="bg-primary/10 text-primary"
        />
        <MoneyCard
          icon={BadgeDollarSign}
          label="A Receber este Mês"
          value={financial.totalToReceiveMonth}
          accent="bg-amber-500/10 text-amber-500"
        />
        <MoneyCard
          icon={DollarSign}
          label="Gastos este Mês"
          value={financial.totalExpensesMonth}
          accent="bg-destructive/10 text-destructive"
        />
        <MoneyCard
          icon={DollarSign}
          label="Gastos Total (Plataforma)"
          value={financial.totalExpensesAllTime}
          accent="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart className="h-4 w-4 text-primary" />
              Evolução Financeira (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={financialChart} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Valor"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="received" name="Recebido" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                <Bar dataKey="pending" name="A receber" radius={[8, 8, 0, 0]} fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {quickActions.map((link) => (
              <button
                key={link.path}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
                onClick={() => navigate(link.path)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                  <link.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{link.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{link.description}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
