import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  BarChart3,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { AdminAutomationPanel } from "@/components/admin/AdminAutomationPanel";
import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  avatar_url?: string | null;
  admin_plan_id?: string | null;
  clientCount?: number;
  planName?: string | null;
}

interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalClients: number;
  totalPlans: number;
  totalServices: number;
  totalTemplates: number;
  totalMessages: number;
}

const AdminUsers = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalClients: 0,
    totalPlans: 0,
    totalServices: 0,
    totalTemplates: 0,
    totalMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: profiles },
        { count: clientCount },
        { count: planCount },
        { count: serviceCount },
        { count: templateCount },
        { count: messageCount },
      ] = await Promise.all([
        supabase.from("profiles").select("*, admin_plans(name)").order("created_at", { ascending: false }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("plans").select("*", { count: "exact", head: true }),
        supabase.from("services").select("*", { count: "exact", head: true }),
        supabase.from("message_templates").select("*", { count: "exact", head: true }),
        supabase.from("message_logs").select("*", { count: "exact", head: true }),
      ]);

      if (profiles) {
        // Fetch client counts per user
        const { data: clientsByUser } = await supabase
          .from("clients")
          .select("user_id");

        const countMap: Record<string, number> = {};
        clientsByUser?.forEach((c) => {
          countMap[c.user_id] = (countMap[c.user_id] || 0) + 1;
        });

        const enriched = profiles.map((p: any) => ({
          ...p,
          clientCount: countMap[p.user_id] || 0,
          planName: p.admin_plans?.name || null,
        }));

        setUsers(enriched);

        const active = profiles.filter((p) => p.is_active).length;
        setMetrics({
          totalUsers: profiles.length,
          activeUsers: active,
          inactiveUsers: profiles.length - active,
          totalClients: clientCount || 0,
          totalPlans: planCount || 0,
          totalServices: serviceCount || 0,
          totalTemplates: templateCount || 0,
          totalMessages: messageCount || 0,
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const toggleActive = async (profile: UserProfile) => {
    const newStatus = !profile.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: `Usuário ${newStatus ? "ativado" : "desativado"} com sucesso` });
      setUsers((prev) =>
        prev.map((u) => (u.id === profile.id ? { ...u, is_active: newStatus } : u))
      );
      setMetrics((prev) => ({
        ...prev,
        activeUsers: prev.activeUsers + (newStatus ? 1 : -1),
        inactiveUsers: prev.inactiveUsers + (newStatus ? -1 : 1),
      }));
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Painel Admin Master
        </h1>
        <p className="text-muted-foreground">Gerenciamento de usuários e métricas da plataforma</p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Usuários</p>
              <p className="text-2xl font-bold">{metrics.totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <UserCheck className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{metrics.activeUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <UserX className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inativos</p>
              <p className="text-2xl font-bold">{metrics.inactiveUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold">{metrics.totalClients}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Planos", value: metrics.totalPlans },
          { label: "Serviços", value: metrics.totalServices },
          { label: "Templates", value: metrics.totalTemplates },
          { label: "Mensagens Enviadas", value: metrics.totalMessages },
        ].map((item) => (
          <Card key={item.label} className={item.label === "Mensagens Enviadas" ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""} onClick={() => item.label === "Mensagens Enviadas" && (window.location.href = "/admin/logs")}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Usuários da Plataforma</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {(user.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {user.full_name || "Sem nome"}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.planName ? (
                        <Badge variant="secondary" className="text-xs">{user.planName}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem plano</span>
                      )}
                    </TableCell>
                    <TableCell>{user.clientCount}</TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => toggleActive(user)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditUser(user); setEditOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdminAutomationPanel />

      <EditUserDialog
        user={editUser}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={fetchData}
      />
    </div>
  );
};

export default AdminUsers;
