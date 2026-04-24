import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings, RefreshCw, Loader2, FilterX } from "lucide-react";
import { formatDateTimeBRT } from "@/lib/date-brt";

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

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientSearch, setClientSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: logsData } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(500);

    if (logsData && logsData.length > 0) {
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

  const templateTypes = useMemo(
    () => [...new Set(logs.map((l) => l.template_type))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date range (compare on YYYY-MM-DD)
      const logDate = log.sent_at.substring(0, 10);
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;

      // Status
      if (statusFilter !== "all" && log.status !== statusFilter) return false;

      // Type
      if (typeFilter !== "all" && log.template_type !== typeFilter) return false;

      // Client name search
      if (clientSearch.trim()) {
        const q = clientSearch.trim().toLowerCase();
        if (!(log.client_name || "").toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [logs, startDate, endDate, statusFilter, typeFilter, clientSearch]);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setTypeFilter("all");
    setClientSearch("");
  };

  const hasActiveFilters =
    startDate || endDate || statusFilter !== "all" || typeFilter !== "all" || clientSearch.trim();

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
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs">Data inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">Data final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de template</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {templateTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-search" className="text-xs">Cliente</Label>
              <Input
                id="client-search"
                placeholder="Buscar pelo nome..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <FilterX className="mr-2 h-4 w-4" />
                Limpar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Mensagens Enviadas ({filteredLogs.length}
            {filteredLogs.length !== logs.length ? ` de ${logs.length}` : ""})
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
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="max-w-xs">Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTimeBRT(log.sent_at)}
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
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    {logs.length === 0
                      ? "Nenhuma mensagem enviada ainda"
                      : "Nenhum resultado para os filtros aplicados"}
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
