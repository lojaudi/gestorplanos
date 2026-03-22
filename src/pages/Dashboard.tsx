import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    { name: "Ativos", value: stats.active, color: "hsl(142, 71%, 45%)" },
    { name: "Vencendo", value: stats.dueToday, color: "hsl(38, 92%, 50%)" },
    { name: "Vencidos", value: stats.overdue, color: "hsl(0, 72%, 51%)" },
  ];

  const quickActions = [
    { icon: Users, label: "Clientes", path: "/clients" },
    { icon: CreditCard, label: "Faturamento", path: "/billing" },
    { icon: Megaphone, label: "Campanhas", path: "/campaign" },
    { icon: FileText, label: "Templates", path: "/templates" },
    { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Total</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-green-500/10 shrink-0">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Ativos</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-yellow-500/10 shrink-0">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Vencendo</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.dueToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Vencidos</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.overdue}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Clientes por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((link) => (
              <Button
                key={link.path}
                variant="ghost"
                className="w-full justify-between h-11 px-3 hover:bg-muted"
                onClick={() => navigate(link.path)}
              >
                <span className="flex items-center gap-3">
                  <link.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{link.label}</span>
                </span>
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
