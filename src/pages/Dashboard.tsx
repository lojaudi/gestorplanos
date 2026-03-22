import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  CreditCard,
  FileText,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
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
  Cell,
} from "recharts";

interface Stats {
  total: number;
  dueToday: number;
  overdue: number;
  active: number;
}

interface FinancialStats {
  totalReceivedAllTime: number;
  totalReceivedMonth: number;
  totalToReceiveMonth: number;
}

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

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ total: 0, dueToday: 0, overdue: 0, active: 0 });
  const [financial, setFinancial] = useState<FinancialStats>({
    totalReceivedAllTime: 0,
    totalReceivedMonth: 0,
    totalToReceiveMonth: 0,
  });

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: clients } = await supabase
        .from("clients")
        .select("due_date, plan_id")
        .eq("user_id", user.id);

      if (clients) {
        const total = clients.length;
        const dueToday = clients.filter((c) => c.due_date === today).length;
        const overdue = clients.filter((c) => c.due_date < today).length;
        const active = clients.filter((c) => c.due_date >= today).length;
        setStats({ total, dueToday, overdue, active });
      }
    };

    const fetchFinancial = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const today = now.toISOString().split("T")[0];

      // Get clients with plan prices
      const { data: clientsWithPlans } = await supabase
        .from("clients")
        .select("due_date, plans(price)")
        .eq("user_id", user.id);

      let totalReceivedAllTime = 0;
      let totalReceivedMonth = 0;
      let totalToReceiveMonth = 0;

      if (clientsWithPlans) {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        for (const client of clientsWithPlans) {
          const price = (client.plans as any)?.price ?? 0;
          if (price <= 0) continue;

          const dueDate = new Date(client.due_date + "T00:00:00");

          // Client is active (due_date >= today) means they paid = received
          if (client.due_date >= today) {
            totalReceivedAllTime += price;
          }

          // Received this month: active clients whose due is in current month or later
          // (they paid this cycle which falls in this month)
          if (
            client.due_date >= today &&
            dueDate.getMonth() === currentMonth &&
            dueDate.getFullYear() === currentYear
          ) {
            totalReceivedMonth += price;
          }

          // To receive this month: overdue or due today clients with due in current month
          if (
            client.due_date <= today &&
            dueDate.getMonth() === currentMonth &&
            dueDate.getFullYear() === currentYear
          ) {
            totalToReceiveMonth += price;
          }
        }
      }

      // Also check payment_links for actual confirmed payments
      const { data: paidLinks } = await supabase
        .from("payment_links")
        .select("amount, created_at, status")
        .eq("user_id", user.id)
        .eq("status", "paid");

      if (paidLinks) {
        for (const link of paidLinks) {
          totalReceivedAllTime += Number(link.amount);
          const createdAt = new Date(link.created_at);
          if (
            createdAt.getMonth() === now.getMonth() &&
            createdAt.getFullYear() === now.getFullYear()
          ) {
            totalReceivedMonth += Number(link.amount);
          }
        }
      }

      setFinancial({ totalReceivedAllTime, totalReceivedMonth, totalToReceiveMonth });
    };

    fetchStats();
    fetchFinancial();
  }, [user]);

  const chartData = [
    { name: "Ativos", value: stats.active, color: "hsl(160, 84%, 39%)" },
    { name: "Vencendo", value: stats.dueToday, color: "hsl(43, 96%, 56%)" },
    { name: "Vencidos", value: stats.overdue, color: "hsl(0, 84%, 60%)" },
  ];

  const quickActions = [
    { icon: Users, label: "Clientes", description: "Gerenciar base", path: "/clients" },
    { icon: CreditCard, label: "Faturamento", description: "Cobranças e pagamentos", path: "/billing" },
    { icon: Megaphone, label: "Campanhas", description: "Enviar mensagens", path: "/campaign" },
    { icon: FileText, label: "Templates", description: "Modelos de mensagem", path: "/templates" },
    { icon: MessageSquare, label: "WhatsApp", description: "Configurar API", path: "/whatsapp" },
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
        <StatCard icon={Users} label="Total de Clientes" value={stats.total} accent="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Clientes Ativos" value={stats.active} accent="bg-emerald-500/10 text-emerald-500" />
        <StatCard icon={Clock} label="Vencem Hoje" value={stats.dueToday} accent="bg-amber-500/10 text-amber-500" />
        <StatCard icon={AlertTriangle} label="Vencidos" value={stats.overdue} accent="bg-destructive/10 text-destructive" />
      </div>

      {/* Financial Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart className="h-4 w-4 text-primary" />
              Clientes por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
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
