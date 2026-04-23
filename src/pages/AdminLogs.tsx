import { useEffect, useState, useCallback } from "react";
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

interface MessageLog {
  id: string;
  message_content: string;
  status: string;
  template_type: string;
  sent_at: string;
  api_response: string | null;
  client_id: string | null;
  user_id: string;
  user_email?: string;
  client_name?: string;
}

export default function AdminLogs() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);

    try {
      const { data: logsData, error } = await supabase
        .from("message_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      if (logsData && logsData.length > 0) {
        // Get user emails
        const userIds = [...new Set(logsData.map((l) => l.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p.email]) || []);

        // Get client names
        const clientIds = [...new Set(logsData.filter((l) => l.client_id).map((l) => l.client_id!))];
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds.length > 0 ? clientIds : ["none"]);

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
  }, [isAdmin]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Logs Globais de Envio
        </h1>
        <p className="text-muted-foreground">Histórico de todas as mensagens enviadas via WhatsApp na plataforma</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mensagens Enviadas ({logs.length})</CardTitle>
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
                <TableHead>Usuário</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
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
                  <TableCell className="max-w-[150px] truncate" title={log.user_email}>
                    {log.user_email}
                  </TableCell>
                  <TableCell>{log.client_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.template_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                      {log.status === "sent" ? "Enviado" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={log.message_content}>
                    {log.message_content.substring(0, 80)}
                    {log.message_content.length > 80 ? "..." : ""}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Nenhuma mensagem enviada ainda
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
