import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Briefcase,
  CreditCard,
  FileText,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
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
    { name: "Vencendo Hoje", value: stats.dueToday, color: "hsl(38, 92%, 50%)" },
    { name: "Vencidos", value: stats.overdue, color: "hsl(0, 84%, 60%)" },
  ];

  const quickLinks = [
    { icon: Users, label: "Clientes", path: "/clients", color: "bg-primary" },
    { icon: Briefcase, label: "Serviços", path: "/services", color: "bg-primary" },
    { icon: CreditCard, label: "Planos", path: "/plans", color: "bg-primary" },
    { icon: FileText, label: "Templates", path: "/templates", color: "bg-primary" },
    { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp", color: "bg-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencendo Hoje</p>
              <p className="text-2xl font-bold">{stats.dueToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencidos</p>
              <p className="text-2xl font-bold">{stats.overdue}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Acesso Rápido</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {quickLinks.map((link) => (
            <Button
              key={link.path}
              variant="outline"
              className="flex h-auto flex-col gap-2 p-4"
              onClick={() => navigate(link.path)}
            >
              <link.icon className="h-6 w-6 text-primary" />
              <span>{link.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
