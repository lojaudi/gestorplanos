import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Crown, Users, Megaphone, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  max_clients: number;
  module_campaigns: boolean;
  module_games: boolean;
  module_banners: boolean;
  is_active: boolean;
  duration_months: number;
  created_at: string;
  updated_at: string;
}

const durationOptions = [
  { value: "1", label: "Mensal (1 mês)" },
  { value: "2", label: "Bimestral (2 meses)" },
  { value: "3", label: "Trimestral (3 meses)" },
  { value: "6", label: "Semestral (6 meses)" },
  { value: "12", label: "Anual (12 meses)" },
];

const defaultForm = {
  name: "",
  description: "",
  price: "",
  max_clients: "50",
  duration_months: "1",
  module_campaigns: false,
  module_games: false,
  module_banners: false,
  is_active: true,
};

const AdminPlans = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("admin_plans")
      .select("*")
      .order("created_at", { ascending: false });
    setPlans((data as AdminPlan[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchPlans();
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (p: AdminPlan) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      max_clients: String(p.max_clients),
      duration_months: String(p.duration_months),
      module_campaigns: p.module_campaigns,
      module_games: p.module_games,
      module_banners: p.module_banners,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = form.name.trim();
    if (!trimmed || !user) return;
    setSaving(true);
    const payload = {
      name: trimmed,
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      max_clients: parseInt(form.max_clients) || 50,
      duration_months: parseInt(form.duration_months) || 1,
      module_campaigns: form.module_campaigns,
      module_games: form.module_games,
      module_banners: form.module_banners,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("admin_plans").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Plano atualizado!" });
      } else {
        const { error } = await supabase.from("admin_plans").insert(payload);
        if (error) throw error;
        toast({ title: "Plano criado!" });
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("admin_plans").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plano excluído!" });
      fetchPlans();
    }
    setDeleteId(null);
  };

  const formatPrice = (p: number) =>
    p.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getDurationLabel = (months: number) => {
    if (months === 0) return "7 dias (Trial)";
    const opt = durationOptions.find((d) => d.value === String(months));
    return opt ? opt.label : `${months} meses`;
  };

  const modulesList = (p: AdminPlan) => {
    const modules: string[] = [];
    if (p.module_campaigns) modules.push("Campanha");
    return modules;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planos de Usuários</h1>
          <p className="text-muted-foreground">Crie e gerencie os planos de assinatura para seus usuários</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Plano
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Máx. Clientes</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Crown className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum plano cadastrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                          {p.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{formatPrice(p.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {getDurationLabel(p.duration_months)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.max_clients}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {modulesList(p).length === 0 ? (
                          <span className="text-muted-foreground text-xs">Nenhum</span>
                        ) : (
                          modulesList(p).map((m) => (
                            <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {m}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "outline"} className="text-[10px]">
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planName">Nome do Plano</Label>
              <Input
                id="planName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Plano Premium"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planDesc">Descrição</Label>
              <Textarea
                id="planDesc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do plano (opcional)"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planPrice">Valor (R$)</Label>
                <Input
                  id="planPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxClients">Máx. de Clientes</Label>
                <Input
                  id="maxClients"
                  type="number"
                  min="1"
                  value={form.max_clients}
                  onChange={(e) => setForm({ ...form, max_clients: e.target.value })}
                  placeholder="50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duração do Plano</Label>
              <Select value={form.duration_months} onValueChange={(v) => setForm({ ...form, duration_months: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durationOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modules */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Módulos inclusos</Label>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Campanha</span>
                  </div>
                  <Switch
                    checked={form.module_campaigns}
                    onCheckedChange={(v) => setForm({ ...form, module_campaigns: v })}
                  />
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label>Plano Ativo</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Usuários vinculados a este plano perderão o acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPlans;
