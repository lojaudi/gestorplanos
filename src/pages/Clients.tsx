import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Search, ChevronLeft, ChevronRight, PenLine, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { BulkEditClientsDialog } from "@/components/clients/BulkEditClientsDialog";
import { WhmcsImportDialog } from "@/components/clients/WhmcsImportDialog";
import { editClientWithInvoiceSync } from "@/lib/client-edit-with-invoice";
import { formatDateBRT, getTodayBRT, shiftDateBRT } from "@/lib/date-brt";

type Client = Tables<"clients">;
type Service = Tables<"services">;
type Plan = Tables<"plans">;

type ClientWithRelations = Client & {
  services: { name: string } | null;
  plans: { name: string; duration_months: number; price: number | null } | null;
};

const getStatus = (dueDate: string) => {
  if (!dueDate) return "sem_fatura";
  const today = getTodayBRT();
  const tomorrow = shiftDateBRT(1);
  if (dueDate === today) return "vencendo";
  if (dueDate === tomorrow) return "vence_amanha";
  if (dueDate < today) return "vencido";
  return "ativo";
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  vencendo: { label: "Vencendo Hoje", variant: "secondary" },
  vence_amanha: { label: "Vence Amanhã", variant: "outline" },
  vencido: { label: "Vencido", variant: "destructive" },
  sem_fatura: { label: "Sem Fatura", variant: "outline" },
};

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100", "all"] as const;

const Clients = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientWithRelations[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "expired" | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [whmcsOpen, setWhmcsOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<string>("10");
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formServiceId, setFormServiceId] = useState<string>("");
  const [formPlanId, setFormPlanId] = useState<string>("");
  const [formDueDate, setFormDueDate] = useState<string>("");

  const fetchData = async () => {
    if (!user) return;
    const [clientsRes, servicesRes, plansRes] = await Promise.all([
      supabase.from("clients").select("*, services(name), plans(name, duration_months, price)").order("created_at", { ascending: false }),
      supabase.from("services").select("*").order("name"),
      supabase.from("plans").select("*").order("name"),
    ]);
    setClients((clientsRes.data as ClientWithRelations[]) || []);
    setServices(servicesRes.data || []);
    setPlans(plansRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const status = getStatus(c.due_date);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (planFilter !== "all" && c.plan_id !== planFilter) return false;
      if (serviceFilter !== "all" && c.service_id !== serviceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.username || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [clients, statusFilter, planFilter, serviceFilter, searchQuery]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(filteredClients.length / Number(pageSize)));
  }, [filteredClients.length, pageSize]);

  // Reset to page 1 when filters or pageSize change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, planFilter, serviceFilter, searchQuery, pageSize]);

  const paginatedClients = useMemo(() => {
    if (pageSize === "all") return filteredClients;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredClients.slice(start, start + size);
  }, [filteredClients, pageSize, currentPage]);

  // Due date calculation removed - invoices manage due dates now

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormPhone("");
    setFormUsername("");
    setFormServiceId("");
    setFormPlanId("");
    setFormDueDate("");
    setDialogOpen(true);
  };

  const openEdit = (c: ClientWithRelations) => {
    setEditing(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormUsername(c.username || "");
    setFormServiceId(c.service_id || "");
    setFormPlanId(c.plan_id || "");
    setFormDueDate(c.due_date || "");
    setDialogOpen(true);
  };

  const handlePlanChange = (planId: string) => {
    setFormPlanId(planId);
  };

  const handleSave = async () => {
    const trimmedName = formName.trim();
    const trimmedPhone = formPhone.trim();
    if (!trimmedName || !trimmedPhone || !user) return;
    setSaving(true);
    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      username: formUsername.trim() || null,
      service_id: formServiceId || null,
      plan_id: formPlanId || null,
    };
    try {
      if (editing) {
        // Update basic fields (name, phone, username, service)
        const { error, data } = await supabase.from("clients").update(payload).eq("id", editing.id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          toast({ title: "Aviso", description: "A atualização pode não ter sido aplicada. Tente novamente.", variant: "destructive" });
        } else {
          // Sync invoices if plan or due date changed
          const result = await editClientWithInvoiceSync({
            clientId: editing.id,
            userId: user.id,
            newPlanId: formPlanId || null,
            newDueDate: formDueDate || editing.due_date,
            oldPlanId: editing.plan_id || null,
            oldDueDate: editing.due_date,
          });
          toast({
            title: result.success ? "Cliente atualizado!" : "Aviso",
            description: result.message,
            variant: result.success ? "default" : "destructive",
          });
        }
      } else {
        const dueDate = formDueDate || getTodayBRT();
        const { data: newClient, error } = await supabase.from("clients").insert({ ...payload, user_id: user.id, due_date: dueDate }).select("id").single();
        if (error) throw error;

        // Auto-generate invoice if client has a plan
        if (newClient && formPlanId) {
          const { data: plan } = await supabase.from("plans").select("price, name").eq("id", formPlanId).single();
          if (plan) {
            await supabase.from("invoices").insert({
              user_id: user.id,
              client_id: newClient.id,
              plan_id: formPlanId,
              amount: plan.price ?? 0,
              due_date: dueDate,
              status: "pending",
              description: plan.name,
            });
          }
        }
        toast({ title: "Cliente criado!" });
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("[Clients] Save error:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("clients").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente excluído!" });
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteId); return n; });
      fetchData();
    }
    setDeleteId(null);
  };

  const expiredClients = useMemo(() => {
    const today = getTodayBRT();
    return clients.filter((c) => c.due_date < today);
  }, [clients]);

  const handleBulkDelete = async () => {
    if (!bulkDeleteMode) return;
    const idsToDelete = bulkDeleteMode === "selected"
      ? Array.from(selected)
      : expiredClients.map((c) => c.id);

    if (idsToDelete.length === 0) return;
    setSaving(true);
    const { error } = await supabase.from("clients").delete().in("id", idsToDelete);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${idsToDelete.length} cliente(s) excluído(s)!` });
      setSelected(new Set());
      fetchData();
    }
    setSaving(false);
    setBulkDeleteMode(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedClients.map((c) => c.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    if (allPageSelected) {
      setSelected((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n; });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">{clients.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWhmcsOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Importar WHMCS
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="vencendo">Vencendo Hoje</SelectItem>
            <SelectItem value="vence_amanha">Vence Amanhã</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Planos</SelectItem>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(selected.size > 0 || expiredClients.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
              <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)}>
                <PenLine className="mr-1 h-4 w-4" /> Editar em massa
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteMode("selected")}>
                <Trash2 className="mr-1 h-4 w-4" /> Excluir selecionados
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                Limpar seleção
              </Button>
            </>
          )}
          {expiredClients.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteMode("expired")}>
              <Trash2 className="mr-1 h-4 w-4" /> Excluir vencidos ({expiredClients.length})
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedClients.length > 0 && paginatedClients.every((c) => selected.has(c.id))}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="hidden md:table-cell">Serviço</TableHead>
                <TableHead className="hidden md:table-cell">Plano</TableHead>
                <TableHead className="hidden md:table-cell">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((c) => {
                  const status = getStatus(c.due_date);
                  const cfg = statusConfig[status];
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          {c.name}
                          {c.username && <span className="block text-xs text-muted-foreground">@{c.username}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.services?.name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.plans?.name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.plans?.price != null
                          ? `R$ ${c.plans.price.toFixed(2).replace(".", ",")}`
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDateBRT(c.due_date)}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Exibir</span>
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === "all" ? "Todos" : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            de {filteredClients.length} cliente(s)
          </span>
        </div>
        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome *</Label>
                <Input id="clientName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Telefone/WhatsApp *</Label>
                <Input id="clientPhone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="5511999999999" maxLength={20} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientUsername">Nome de Usuário (opcional)</Label>
              <Input id="clientUsername" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="@usuario" maxLength={50} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={formServiceId} onValueChange={setFormServiceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={formPlanId} onValueChange={handlePlanChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientDueDate">Data de Vencimento</Label>
              <Input id="clientDueDate" type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formPhone.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados deste cliente serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={!!bulkDeleteMode} onOpenChange={() => setBulkDeleteMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkDeleteMode === "selected"
                ? `Excluir ${selected.size} cliente(s) selecionado(s)?`
                : `Excluir ${expiredClients.length} cliente(s) vencido(s)?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados desses clientes serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={saving}>
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Dialog */}
      <BulkEditClientsDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={Array.from(selected)}
        selectedNames={clients.filter((c) => selected.has(c.id)).map((c) => c.name)}
        services={services}
        plans={plans}
        onUpdated={() => { fetchData(); setSelected(new Set()); }}
      />

      <WhmcsImportDialog
        open={whmcsOpen}
        onClose={() => setWhmcsOpen(false)}
        onImported={() => { fetchData(); }}
      />
    </div>
  );
};

export default Clients;
