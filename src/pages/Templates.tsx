import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, FileText, Eye } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Template = Tables<"message_templates">;

const templateTypes = [
  { value: "vencendo_hoje", label: "Vencendo Hoje" },
  { value: "vencido", label: "Vencido" },
  { value: "proximos_3_dias", label: "Próximos 3 Dias" },
  { value: "confirmacao_pagamento", label: "Confirmação de Pagamento" },
];

const variables = [
  { tag: "{nome}", description: "Nome do cliente" },
  { tag: "{servico}", description: "Serviço contratado" },
  { tag: "{plano}", description: "Nome do plano" },
  { tag: "{data_vencimento}", description: "Data de vencimento" },
  { tag: "{data_pagamento}", description: "Data do pagamento" },
  { tag: "{proximo_vencimento}", description: "Data do próximo vencimento" },
  { tag: "{meio_de_pagamento}", description: "Código Pix gerado automaticamente (requer Gateway ativo)" },
  { tag: "{link_pagamento}", description: "Link da página pública de pagamento (requer Gateway ativo)" },
];

const sampleData: Record<string, string> = {
  "{nome}": "João Silva",
  "{servico}": "IPTV Premium",
  "{plano}": "Mensal",
  "{data_vencimento}": "15/03/2026",
  "{data_pagamento}": "14/03/2026",
  "{proximo_vencimento}": "15/04/2026",
  "{meio_de_pagamento}": "00020126580014br.gov.bcb.pix0136exemplo-chave-pix-aqui5204000053039865802BR5913Exemplo6008Cidade62070503***6304ABCD",
  "{link_pagamento}": "https://exemplo.com/pay?id=abc123",
};

const replaceVariables = (content: string) => {
  let result = content;
  for (const [tag, value] of Object.entries(sampleData)) {
    result = result.split(tag).join(value);
  }
  return result;
};

const getTypeLabel = (type: string) => {
  return templateTypes.find((t) => t.value === type)?.label || type;
};

const getTypeBadgeVariant = (type: string) => {
  switch (type) {
    case "vencendo_hoje": return "secondary" as const;
    case "vencido": return "destructive" as const;
    case "proximos_3_dias": return "default" as const;
    case "confirmacao_pagamento": return "outline" as const;
    default: return "outline" as const;
  }
};

const Templates = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("vencendo_hoje");
  const [formContent, setFormContent] = useState("");

  const fetchTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [user]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormType("vencendo_hoje");
    setFormContent("");
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setFormName(t.name);
    setFormType(t.type);
    setFormContent(t.content);
    setDialogOpen(true);
  };

  const openPreview = (content: string) => {
    setPreviewContent(replaceVariables(content));
    setPreviewOpen(true);
  };

  const insertVariable = (tag: string) => {
    setFormContent((prev) => prev + tag);
  };

  const handleSave = async () => {
    const trimmedName = formName.trim();
    const trimmedContent = formContent.trim();
    if (!trimmedName || !trimmedContent || !user) return;
    setSaving(true);
    const payload = { name: trimmedName, type: formType, content: trimmedContent };
    try {
      if (editing) {
        const { error } = await supabase.from("message_templates").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Template atualizado!" });
      } else {
        const { error } = await supabase.from("message_templates").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast({ title: "Template criado!" });
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Template excluído!" });
      fetchTemplates();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Mensagens</h1>
          <p className="text-muted-foreground">Modelos de mensagens para cobranças via WhatsApp</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Template
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Conteúdo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum template cadastrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(t.type)}>{getTypeLabel(t.type)}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs truncate text-muted-foreground">
                      {t.content}
                    </TableCell>
                    <TableCell>{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openPreview(t.content)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
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
            <DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="templateName">Nome do Template</Label>
                <Input id="templateName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Lembrete de Vencimento" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {templateTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label>Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {variables.map((v) => (
                  <Button key={v.tag} type="button" variant="outline" size="sm" onClick={() => insertVariable(v.tag)} title={v.description}>
                    {v.tag}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateContent">Conteúdo da Mensagem</Label>
              <Textarea
                id="templateContent"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Olá {nome}, sua assinatura do serviço {servico} (plano {plano}) vence em {data_vencimento}..."
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">{formContent.length}/2000 caracteres</p>
            </div>

            {/* Live Preview */}
            {formContent.trim() && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap text-sm">{replaceVariables(formContent)}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formContent.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview da Mensagem</DialogTitle>
          </DialogHeader>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="whitespace-pre-wrap text-sm">{previewContent}</p>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
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

export default Templates;
