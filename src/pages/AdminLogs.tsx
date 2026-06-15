import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Loader2, ClipboardList } from "lucide-react";
import { formatDateTimeBRT } from "@/lib/date-brt";

interface NotificationLog {
  id: string;
  message_content: string | null;
  status: string;
  notification_type: string;
  sent_at: string;
  client_id: string | null;
  user_id: string;
  due_date: string | null;
  user_email?: string;
  client_name?: string;
}

const TYPE_LABEL: Record<string, string> = {
  before_due: "Antes do vencimento",
  on_due: "No vencimento",
  after_due: "Após vencimento",
  payment_confirmed: "Pagamento confirmado",
};

export default function AdminLogs() {
  const { isAdmin, user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterUserId = searchParams.get("userId");
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("billing_notifications_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(300);

      if (filterUserId) {
        query = query.eq("user_id", filterUserId);
      } else if (!isAdmin && user) {
        query = query.eq("user_id", user.id);
      }

      const { data: logsData, error } = await query;
      if (error) throw error;

      if (logsData && logsData.length > 0) {
        const userIds = [...new Set(logsData.map((l) => l.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", userIds);
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p.email]) || []);

        const clientIds = [...new Set(logsData.filter((l) => l.client_id).map((l) => l.client_id!))];
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds.length > 0 ? clientIds : ["00000000-0000-0000-0000-000000000000"]);
        const clientMap = new Map(clients?.map((c) => [c.id, c.name]) || []);

        setLogs(
          logsData.map((l) => ({
            ...l,
            user_email: profileMap.get(l.user_id) || "—",
            client_name: l.client_id ? clientMap.get(l.client_id) || "—" : "—",
          }))
        );
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterUserId, user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sentCount = logs.filter((l) => l.status === "sent").length;
  const errorCount = logs.filter((l) => l.status !== "sent").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Logs de Notificações Automáticas
        </h1>
        <p className="text-muted-foreground">
          Histórico de cobranças e confirmações de pagamento enviadas automaticamente pelo sistema.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Notificações ({logs.length}) · Enviadas: {sentCount} · Erros: {errorCount}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                {isAdmin && <TableHead>Usuário</TableHead>}
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="max-w-xs">Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTimeBRT(log.sent_at)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="max-w-[150px] truncate" title={log.user_email}>
                      {log.user_email}
                    </TableCell>
                  )}
                  <TableCell>{log.client_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TYPE_LABEL[log.notification_type] || log.notification_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {log.due_date ? new Date(log.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                      {log.status === "sent" ? "Enviado" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={log.message_content || ""}>
                    {(log.message_content || "").substring(0, 80)}
                    {(log.message_content || "").length > 80 ? "..." : ""}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-10">
                    Nenhuma notificação automática registrada ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
