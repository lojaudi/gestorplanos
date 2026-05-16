import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  PlugZap,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Server,
} from "lucide-react";
import { formatDateTimeBRT } from "@/lib/date-brt";

type IptvServer = {
  id: string;
  name: string;
  host: string;
  port: number;
  db_user: string;
  db_name: string;
  admin_id: number;
  is_active: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
};

type FormState = {
  id?: string;
  name: string;
  host: string;
  port: string;
  db_user: string;
  db_password: string;
  db_name: string;
  admin_id: string;
};

const emptyForm: FormState = {
  name: "",
  host: "",
  port: "7999",
  db_user: "",
  db_password: "",
  db_name: "xui_iptvpro",
  admin_id: "1",
};

export default function IptvServers() {
  const { user } = useAuth();
  const [servers, setServers] = useState<IptvServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("iptv_servers")
      .select(
        "id, name, host, port, db_user, db_name, admin_id, is_active, last_test_at, last_test_ok, last_test_message",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar servidores");
    setServers((data as IptvServer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: IptvServer) => {
    setForm({
      id: s.id,
      name: s.name,
      host: s.host,
      port: String(s.port),
      db_user: s.db_user,
      db_password: "",
      db_name: s.db_name,
      admin_id: String(s.admin_id),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name || !form.host || !form.db_user || !form.db_name) {
      toast.error("Preencha nome, host, usuário e database");
      return;
    }
    if (!form.id && !form.db_password) {
      toast.error("Informe a senha do MySQL");
      return;
    }
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/iptv-server-save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session?.access_token}`,
          },
          body: JSON.stringify({
            id: form.id ?? null,
            name: form.name,
            host: form.host,
            port: Number(form.port) || 7999,
            db_user: form.db_user,
            db_password: form.db_password || null,
            db_name: form.db_name,
            admin_id: Number(form.admin_id) || 1,
          }),
        },
      );
      const out = await resp.json();
      if (!resp.ok || out.error) throw new Error(out.error || "Falha ao salvar");
      toast.success(form.id ? "Servidor atualizado" : "Servidor cadastrado");
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.host || !form.db_user || !form.db_name) {
      toast.error("Preencha host, usuário e database");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("iptv-xui-sync", {
        body: {
          action: "test-connection",
          server_id: form.id,
          connection: form.db_password
            ? {
                host: form.host,
                port: Number(form.port) || 7999,
                db_user: form.db_user,
                db_password: form.db_password,
                db_name: form.db_name,
              }
            : undefined,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Conexão OK${data.version ? ` — MySQL ${data.version}` : ""}`);
      } else {
        toast.error(`Falhou: ${data?.error ?? "erro desconhecido"}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro no teste");
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("iptv_servers").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Servidor removido");
      await load();
    }
    setDeleteId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Server className="h-6 w-6" /> Servidores IPTV (XUI.One)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre os servidores XUI.One para sincronizar criação, renovação e bloqueio das linhas dos clientes.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo servidor
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum servidor cadastrado ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {servers.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    {s.last_test_ok === true ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" /> OK
                      </Badge>
                    ) : s.last_test_ok === false ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Falhou
                      </Badge>
                    ) : (
                      <Badge variant="outline">não testado</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-mono">{s.host}:{s.port}</span>
                  </div>
                  <div className="text-muted-foreground">
                    db: <span className="font-mono">{s.db_name}</span> · user:{" "}
                    <span className="font-mono">{s.db_user}</span> · admin_id:{" "}
                    <span className="font-mono">{s.admin_id}</span>
                  </div>
                  {s.last_test_at && (
                    <div className="text-xs text-muted-foreground">
                      Último teste: {formatDateTimeBRT(s.last_test_at)}
                      {s.last_test_message ? ` — ${s.last_test_message}` : ""}
                    </div>
                  )}
                  <div className="flex gap-2 pt-3">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {form.id ? "Editar servidor IPTV" : "Novo servidor IPTV"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Servidor BR-01"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label>Host</Label>
                  <Input
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    placeholder="IP ou domínio"
                  />
                </div>
                <div>
                  <Label>Porta MySQL</Label>
                  <Input
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Usuário MySQL</Label>
                  <Input
                    value={form.db_user}
                    onChange={(e) => setForm({ ...form, db_user: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Database</Label>
                  <Input
                    value={form.db_name}
                    onChange={(e) => setForm({ ...form, db_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Senha MySQL {form.id && "(deixe em branco para manter)"}</Label>
                <Input
                  type="password"
                  value={form.db_password}
                  onChange={(e) => setForm({ ...form, db_password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label>admin_id no XUI.One</Label>
                <Input
                  value={form.admin_id}
                  onChange={(e) => setForm({ ...form, admin_id: e.target.value })}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ID do admin/revendedor dono das linhas criadas (geralmente 1).
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Testar conexão
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir servidor?</AlertDialogTitle>
              <AlertDialogDescription>
                As linhas vinculadas no XUI.One continuarão existindo no painel — apenas o
                cadastro aqui no CRM será removido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
