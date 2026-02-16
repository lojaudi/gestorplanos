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
import { toast } from "@/hooks/use-toast";
import { Settings, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface MessageLog {
  id: string;
  message_content: string;
  status: string;
  template_type: string;
  sent_at: string;
  api_response: string | null;
  client_id: string | null;
  client_name?: string;
}

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: logsData } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(200);

    if (logsData && logsData.length > 0) {
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
          client_name: l.client_id ? clientMap.get(l.client_id) || "—" : "—",
        }))
      );
    } else {
      setLogs([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

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
          <Settings className="h-6 w-6 text-primary" />
          Logs de Envio
        </h1>
        <p className="text-muted-foreground">Histórico de mensagens enviadas via WhatsApp</p>
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
                    {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm")}
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
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
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
