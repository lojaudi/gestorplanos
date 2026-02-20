import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BookOpen, GripVertical } from "lucide-react";

interface SupportMaterial {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

const AdminSupportMaterials = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<SupportMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupportMaterial | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formPublished, setFormPublished] = useState(true);

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("support_materials")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    setMaterials((data as SupportMaterial[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchMaterials(); }, [user]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle("");
    setFormContent("");
    setFormPublished(true);
    setDialogOpen(true);
  };

  const openEdit = (m: SupportMaterial) => {
    setEditing(m);
    setFormTitle(m.title);
    setFormContent(m.content);
    setFormPublished(m.is_published);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const title = formTitle.trim();
    const content = formContent.trim();
    if (!title || !content) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("support_materials")
          .update({ title, content, is_published: formPublished })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Material atualizado!" });
      } else {
        const { error } = await supabase
          .from("support_materials")
          .insert({ title, content, is_published: formPublished, sort_order: materials.length });
        if (error) throw error;
        toast({ title: "Material criado!" });
      }
      setDialogOpen(false);
      fetchMaterials();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("support_materials").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Material excluído!" });
      fetchMaterials();
    }
    setDeleteId(null);
  };

  const togglePublished = async (m: SupportMaterial) => {
    await supabase.from("support_materials").update({ is_published: !m.is_published }).eq("id", m.id);
    fetchMaterials();
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Material de Apoio</h1>
          <p className="text-muted-foreground">Gerencie materiais e modelos disponíveis para os usuários</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Material
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="hidden md:table-cell">Conteúdo</TableHead>
                <TableHead>Publicado</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : materials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum material cadastrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs truncate text-muted-foreground">
                      {m.content.substring(0, 80)}...
                    </TableCell>
                    <TableCell>
                      <Switch checked={m.is_published} onCheckedChange={() => togglePublished(m)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Material" : "Novo Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="materialTitle">Título</Label>
              <Input
                id="materialTitle"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Modelo de Mensagem de Boas-Vindas 📋"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialContent">Conteúdo</Label>
              <p className="text-xs text-muted-foreground">Emojis são suportados! Use-os para dar destaque ao conteúdo 🎨✨</p>
              <Textarea
                id="materialContent"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Digite o conteúdo do material de apoio... 📝&#10;&#10;Use emojis para dar mais visual!"
                rows={10}
                className="text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formPublished} onCheckedChange={setFormPublished} id="published" />
              <Label htmlFor="published">Publicar para usuários</Label>
            </div>

            {/* Preview */}
            {formContent.trim() && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap text-sm">{formContent}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formTitle.trim() || !formContent.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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

export default AdminSupportMaterials;
