import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Crown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface AdminPlan {
  id: string;
  name: string;
  price: number;
  max_clients: number;
  duration_months: number;
  module_campaigns: boolean;
  module_games: boolean;
  module_banners: boolean;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  admin_plan_id?: string | null;
}

interface EditUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditUserDialog({ user, open, onOpenChange, onUpdated }: EditUserDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("none");
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("admin_plans")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setPlans((data as AdminPlan[]) || []));
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setNewPassword("");
      setSelectedPlanId(user.admin_plan_id || "none");
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast({ title: "O campo Nome Completo é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const planId = selectedPlanId === "none" ? null : selectedPlanId;

      // Calculate new plan_expires_at when plan changes
      const profileUpdate: Record<string, any> = { full_name: fullName, email, admin_plan_id: planId };
      if (planId && planId !== user.admin_plan_id) {
        const selectedPlan = plans.find((p) => p.id === planId);
        if (selectedPlan) {
          const now = new Date();
          if (selectedPlan.name === "Free") {
            // Free/trial: 7 days
            now.setDate(now.getDate() + 7);
          } else {
            now.setMonth(now.getMonth() + selectedPlan.duration_months);
          }
          profileUpdate.plan_expires_at = now.toISOString();
        }
      } else if (!planId) {
        profileUpdate.plan_expires_at = null;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);

      if (profileError) throw profileError;

      const updates: Record<string, string> = {};
      if (email !== user.email) updates.email = email;
      if (newPassword) updates.password = newPassword;

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase.functions.invoke("admin-update-user", {
          body: { user_id: user.user_id, ...updates },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast({ title: "Usuário atualizado com sucesso" });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const currentPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nova Senha (deixe em branco para manter)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {/* Plan selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-primary" />
              Plano do Usuário
            </Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentPlan && (
              <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
                <p className="text-muted-foreground">
                  Máx. Clientes: <span className="font-medium text-foreground">{currentPlan.max_clients}</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {currentPlan.module_campaigns && <Badge variant="secondary" className="text-[10px]">Campanha</Badge>}
                  {!currentPlan.module_campaigns && (
                    <span className="text-muted-foreground text-xs">Nenhum módulo incluso</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => setConfirmOpen(true)} disabled={saving} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja salvar as alterações deste usuário?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
