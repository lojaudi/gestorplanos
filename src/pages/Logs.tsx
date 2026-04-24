import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Settings, RefreshCw, Loader2, FilterX, Download, Trash2 } from "lucide-react";
import { formatDateTimeBRT } from "@/lib/date-brt";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const FETCH_BATCH_SIZE = 500;

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const fetchTokenRef = useRef(0);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientSearch, setClientSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection / deletion
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | "selected" | "all" | "filtered">(null);

  const enrichWithClientNames = useCallback(async (rows: MessageLog[]) => {
    const clientIds = [...new Set(rows.filter((l) => l.client_id).map((l) => l.client_id!))];
    if (clientIds.length === 0) {
      return rows.map((l) => ({ ...l, client_name: "—" }));
    }
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds);
    const clientMap = new Map(clients?.map((c) => [c.id, c.name]) || []);
    return rows.map((l) => ({
      ...l,
      client_name: l.client_id ? clientMap.get(l.client_id) || "—" : "—",
    }));
  }, []);

  const fetchInitial = useCallback(async () => {
    if (!user) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);

    // Get total count
    const { count } = await supabase
      .from("message_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (token !== fetchTokenRef.current) return;
    setTotalCount(count ?? 0);

    const { data: logsData } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .range(0, FETCH_BATCH_SIZE - 1);

    if (token !== fetchTokenRef.current) return;

    const rows = logsData || [];
    const enriched = await enrichWithClientNames(rows);

    if (token !== fetchTokenRef.current) return;

    setLogs(enriched);
    setHasMore(rows.length === FETCH_BATCH_SIZE && (count ?? 0) > rows.length);
    setLoading(false);
    setPage(1);
  }, [user, enrichWithClientNames]);

  const fetchMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const offset = logs.length;
    const { data: logsData } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .range(offset, offset + FETCH_BATCH_SIZE - 1);

    const rows = logsData || [];
    const enriched = await enrichWithClientNames(rows);
    setLogs((prev) => [...prev, ...enriched]);
    setHasMore(
      rows.length === FETCH_BATCH_SIZE &&
        (totalCount === null || offset + rows.length < totalCount)
    );
    setLoadingMore(false);
  }, [user, loadingMore, hasMore, logs.length, totalCount, enrichWithClientNames]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  const templateTypes = useMemo(
    () => [...new Set(logs.map((l) => l.template_type))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logDate = log.sent_at.substring(0, 10);
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (typeFilter !== "all" && log.template_type !== typeFilter) return false;
      if (clientSearch.trim()) {
        const q = clientSearch.trim().toLowerCase();
        if (!(log.client_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, startDate, endDate, statusFilter, typeFilter, clientSearch]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, statusFilter, typeFilter, clientSearch, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Selection helpers
  const allOnPageSelected =
    paginatedLogs.length > 0 && paginatedLogs.every((l) => selected.has(l.id));
  const someOnPageSelected =
    paginatedLogs.some((l) => selected.has(l.id)) && !allOnPageSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      paginatedLogs.forEach((l) => {
        if (checked) next.add(l.id);
        else next.delete(l.id);
      });
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // Clear stale selection when underlying logs change
  useEffect(() => {
    setSelected((prev) => {
      const validIds = new Set(logs.map((l) => l.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (validIds.has(id)) next.add(id); });
      return next;
    });
  }, [logs]);

  const performDelete = async (mode: "selected" | "all" | "filtered") => {
    if (!user) return;
    setDeleting(true);
    try {
      let deletedCount = 0;
      if (mode === "all") {
        const { error, count } = await supabase
          .from("message_logs")
          .delete({ count: "exact" })
          .eq("user_id", user.id);
        if (error) throw error;
        deletedCount = count ?? 0;
      } else {
        const ids =
          mode === "selected"
            ? Array.from(selected)
            : filteredLogs.map((l) => l.id);
        if (ids.length === 0) {
          setDeleting(false);
          setConfirmOpen(null);
          return;
        }
        // Chunk to avoid URL length limits
        const chunkSize = 200;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { error, count } = await supabase
            .from("message_logs")
            .delete({ count: "exact" })
            .eq("user_id", user.id)
            .in("id", chunk);
          if (error) throw error;
          deletedCount += count ?? 0;
        }
      }
      toast({
        title: "Logs excluídos",
        description: `${deletedCount} registro(s) removido(s).`,
      });
      clearSelection();
      setConfirmOpen(null);
      await fetchInitial();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao excluir", description: message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };


  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setTypeFilter("all");
    setClientSearch("");
  };

  const hasActiveFilters =
    startDate || endDate || statusFilter !== "all" || typeFilter !== "all" || clientSearch.trim();

  const exportCSV = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "Nada para exportar", description: "Nenhum log nos filtros atuais." });
      return;
    }
    const header = ["Data/Hora", "Cliente", "Tipo", "Status", "Mensagem"];
    const escape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    const rows = filteredLogs.map((l) =>
      [
        formatDateTimeBRT(l.sent_at),
        l.client_name || "—",
        l.template_type,
        l.status === "sent" ? "Enviado" : "Erro",
        l.message_content,
      ]
        .map(escape)
        .join(",")
    );
    const csv = [header.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-envio-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build a compact pagination range with ellipses
  const paginationItems = useMemo(() => {
    const items: (number | "…")[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      if (start > 2) items.push("…");
      for (let i = start; i <= end; i++) items.push(i);
      if (end < totalPages - 1) items.push("…");
      items.push(totalPages);
    }
    return items;
  }, [currentPage, totalPages]);

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
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">Data final</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>
              Mensagens Enviadas ({filteredLogs.length}
              {filteredLogs.length !== logs.length ? ` de ${logs.length}` : ""}
              {totalCount !== null && logs.length < totalCount ? ` · total ${totalCount}` : ""})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Carregados {logs.length}{totalCount !== null ? ` de ${totalCount}` : ""} registros
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selected.size} selecionado(s)
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Limpar seleção
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen("selected")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir selecionados
                </Button>
              </>
            )}
            {hasActiveFilters && filteredLogs.length > 0 && selected.size === 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen("filtered")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir filtrados
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen("all")}
              disabled={(totalCount ?? 0) === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir tudo
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchInitial}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
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
              {paginatedLogs.map((log) => (
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
              {paginatedLogs.length === 0 && (
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

          {filteredLogs.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Itens por página:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="hidden sm:inline">
                  · Página {currentPage} de {totalPages}
                </span>
              </div>

              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => { e.preventDefault(); if (currentPage > 1) setPage(currentPage - 1); }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {paginationItems.map((item, idx) =>
                    item === "…" ? (
                      <PaginationItem key={`e-${idx}`}>
                        <span className="px-3 text-muted-foreground">…</span>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={item === currentPage}
                          onClick={(e) => { e.preventDefault(); setPage(item as number); }}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setPage(currentPage + 1); }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={fetchMore} disabled={loadingMore}>
                {loadingMore ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</>
                ) : (
                  <>Carregar mais {totalCount !== null ? `(${totalCount - logs.length} restantes)` : ""}</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
