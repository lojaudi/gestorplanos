import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle,
  Megaphone,
  ArrowRight,
  TrendingUp,
  MessageSquare,
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

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ total: 0, dueToday: 0, overdue: 0, active: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: clients } = await supabase
        .from("clients")
        .select("due_date")
        .eq("user_id", user.id);

      if (clients) {
        const total = clients.length;
        const dueToday = clients.filter((c) => c.due_date === today).length;
        const overdue = clients.filter((c) => c.due_date < today).length;
        const active = clients.filter((c) => c.due_date >= today).length;
        setStats({ total, dueToday, overdue, active });
      }
    };
    fetchStats();
  }, [user]);

  const chartData = [
    { name: "Ativos", value: stats.active, color: "hsl(var(--success))" },
    { name: "Vencendo Hoje", value: stats.dueToday, color: "hsl(var(--warning))" },
    { name: "Vencidos", value: stats.overdue, color: "hsl(var(--destructive))" },
  ];

  const statCards = [
    {
      icon: Users,
      label: "Total Clientes",
      value: stats.total,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      icon: CheckCircle,
      label: "Ativos",
      value: stats.active,
      iconClass: "text-emerald-500",
      bgClass: "bg-emerald-500/10",
    },
    {
      icon: Clock,
      label: "Vencendo Hoje",
      value: stats.dueToday,
      iconClass: "text-amber-500",
      bgClass: "bg-amber-500/10",
    },
    {
      icon: AlertTriangle,
      label: "Vencidos",
      value: stats.overdue,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
  ];

  const quickActions = [
    { icon: Users, label: "Clientes", description: "Gerenciar cadastros", path: "/clients" },
    { icon: CreditCard, label: "Cobrança", description: "Faturamento e envios", path: "/billing" },
    { icon: Megaphone, label: "Campanhas", description: "Disparo em massa", path: "/campaign" },
    { icon: MessageSquare, label: "WhatsApp", description: "Configurar API", path: "/whatsapp" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu CRM</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-border/50">
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${card.bgClass}`}>
                <card.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.iconClass}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{card.label}</p>
                <p className="text-xl sm:text-2xl font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clientes por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    color: "hsl(var(--foreground))",
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

        {/* Quick Actions */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Button
                key={action.path}
                variant="ghost"
                className="w-full justify-between h-auto py-3 px-3 hover:bg-accent"
                onClick={() => navigate(action.path)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <action.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
