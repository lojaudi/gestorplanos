import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Service = Tables<"services">;
type Plan = Tables<"plans">;

interface BulkEditClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  selectedNames: string[];
  services: Service[];
  plans: Plan[];
  onUpdated: () => void;
}

export function BulkEditClientsDialog({
  open, onOpenChange, selectedIds, selectedNames, services, plans, onUpdated,
}: BulkEditClientsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Which fields to edit
  const [editService, setEditService] = useState(false);
  const [editPlan, setEditPlan] = useState(false);
  const [editDueDate, setEditDueDate] = useState(false);

  // Field values
  const [serviceId, setServiceId] = useState("");
  const [planId, setPlanId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const resetForm = () => {
    setEditService(false);
    setEditPlan(false);
    setEditDueDate(false);
    setServiceId("");
    setPlanId("");
    setDueDate("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const hasChanges = editService || editPlan || editDueDate;

  const isValid = () => {
    if (editService && !serviceId) return false;
    if (editPlan && !planId) return false;
    if (editDueDate && !dueDate) return false;
    return hasChanges;
  };

  const handleConfirmSave = async () => {
    if (!user || !isValid()) return;
    setSaving(true);

    const payload: Record<string, unknown> = {};
    const changes: string[] = [];

    if (editService) {
      payload.service_id = serviceId;
      const svc = services.find((s) => s.id === serviceId);
      changes.push(`Serviço → ${svc?.name || serviceId}`);
    }
    if (editPlan) {
      payload.plan_id = planId;
      const pl = plans.find((p) => p.id === planId);
      changes.push(`Plano → ${pl?.name || planId}`);
    }
    if (editDueDate) {
      payload.due_date = dueDate;
      changes.push(`Vencimento → ${new Date(dueDate + "T00:00:00").toLocaleDateString("pt-BR")}`);
    }

    try {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .in("id", selectedIds);
      if (error) throw error;

      // Audit log
      const logContent = `Edição em massa de ${selectedIds.length} cliente(s): ${changes.join("; ")}`;
      await supabase.from("message_logs").insert({
        user_id: user.id,
        template_type: "bulk_edit",
        message_content: logContent,
        status: "success",
      });

      toast({ title: `${selectedIds.length} cliente(s) atualizado(s)!` });
      handleOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edição em Massa ({selectedIds.length} clientes)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Protected fields notice */}
            <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Campos protegidos (não editáveis):</p>
              <p>Nome, Nome de Usuário, Telefone/WhatsApp</p>
            </div>

            {/* Selected clients preview */}
            <div className="text-sm">
              <p className="font-medium mb-1">Clientes selecionados:</p>
              <p className="text-muted-foreground line-clamp-3">
                {selectedNames.slice(0, 5).join(", ")}
                {selectedNames.length > 5 && ` e mais ${selectedNames.length - 5}...`}
              </p>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Selecione os campos para editar:</p>

              {/* Service */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="editService" checked={editService} onCheckedChange={(v) => setEditService(!!v)} />
                  <Label htmlFor="editService" className="cursor-pointer">Serviço</Label>
                </div>
                {editService && (
                  <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o serviço..." /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Plan */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="editPlan" checked={editPlan} onCheckedChange={(v) => setEditPlan(!!v)} />
                  <Label htmlFor="editPlan" className="cursor-pointer">Plano</Label>
                </div>
                {editPlan && (
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o plano..." /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Due Date */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="editDueDate" checked={editDueDate} onCheckedChange={(v) => setEditDueDate(!!v)} />
                  <Label htmlFor="editDueDate" className="cursor-pointer">Data de Vencimento</Label>
                </div>
                {editDueDate && (
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!isValid()}>
              Aplicar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar edição em massa?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações serão aplicadas a {selectedIds.length} cliente(s). Esta ação não pode ser desfeita facilmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={saving}>
              {saving ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
