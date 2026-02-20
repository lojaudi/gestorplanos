import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Megaphone, ImagePlus, Send, Users, UserCheck, UserX, Loader2, X } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string;
  due_date: string;
}

function getStatus(dueDate: string): "ativo" | "vencido" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return due >= today ? "ativo" : "vencido";
}

export default function Campaign() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingTarget, setSendingTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "A imagem deve ter no máximo 2MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo de imagem.", variant: "destructive" });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fetchClients = useCallback(async (filter: "all" | "active" | "expired"): Promise<Client[]> => {
    if (!user) return [];
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, due_date")
      .eq("user_id", user.id);
    if (error || !data) return [];

    if (filter === "all") return data;
    return data.filter((c) => {
      const status = getStatus(c.due_date);
      return filter === "active" ? status === "ativo" : status === "vencido";
    });
  }, [user]);

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `campaign/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("platform-assets").upload(path, imageFile, { upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const BATCH_SIZE = 40;

  const handleSend = async (filter: "all" | "active" | "expired") => {
    if (!message.trim()) {
      toast({ title: "Mensagem vazia", description: "Digite uma mensagem para enviar.", variant: "destructive" });
      return;
    }
    if (!user) return;

    const targetLabel = filter === "all" ? "Todos" : filter === "active" ? "Ativos" : "Vencidos";
    setSending(true);
    setSendingTarget(targetLabel);

    try {
      const clients = await fetchClients(filter);
      if (clients.length === 0) {
        toast({ title: "Nenhum cliente", description: `Nenhum cliente ${targetLabel.toLowerCase()} encontrado.`, variant: "destructive" });
        return;
      }

      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          toast({ title: "Erro no upload", description: "Não foi possível enviar a imagem.", variant: "destructive" });
          return;
        }
      }

      // Split clients into batches to avoid edge function timeout
      const batches: Client[][] = [];
      for (let i = 0; i < clients.length; i += BATCH_SIZE) {
        batches.push(clients.slice(i, i + BATCH_SIZE));
      }

      let totalSent = 0;
      for (const batch of batches) {
        if (imageUrl) {
          const { data, error } = await supabase.functions.invoke("evolution-api", {
            body: {
              action: "send-bulk-media",
              messages: batch.map((c) => ({ phone: c.phone, client_id: c.id, template_type: "campanha" })),
              imageUrl,
              caption: message.trim(),
            },
          });
          if (error) {
            const errBody = data || (error as any)?.context;
            throw new Error(errBody?.error || error.message);
          }
        } else {
          const { data, error } = await supabase.functions.invoke("evolution-api", {
            body: {
              action: "send-bulk",
              messages: batch.map((c) => ({ phone: c.phone, message: message.trim(), client_id: c.id, template_type: "campanha" })),
            },
          });
          if (error) {
            const errBody = data || (error as any)?.context;
            throw new Error(errBody?.error || error.message);
          }
        }
        totalSent += batch.length;
      }

      toast({ title: "Campanha enviada!", description: `Mensagem enviada para ${totalSent} clientes (${targetLabel}).` });

      await supabase.from("message_logs").insert({
        user_id: user.id,
        message_content: `[Campanha - ${targetLabel}] ${message.trim().slice(0, 200)}`,
        status: "sent",
        template_type: "campanha",
      });
    } catch (err: any) {
      console.error("Campaign send error:", err);
      toast({ title: "Erro ao enviar", description: err?.message || "Erro desconhecido.", variant: "destructive" });
    } finally {
      setSending(false);
      setSendingTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campanha</h1>
        <p className="text-muted-foreground">Envie mensagens e imagens para seus clientes via WhatsApp.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Nova Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-message">Mensagem</Label>
            <Textarea
              id="campaign-message"
              placeholder="Digite a mensagem da campanha..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>
          </div>

          <div className="space-y-2">
            <Label>Imagem (opcional, até 2MB)</Label>
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg border" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={removeImage}
                  disabled={sending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-sm">Clique para anexar uma imagem</span>
              </div>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              disabled={sending}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => handleSend("all")}
              disabled={sending || !message.trim()}
            >
              {sending && sendingTarget === "Todos" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              Enviar para Todos
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => handleSend("active")}
              disabled={sending || !message.trim()}
            >
              {sending && sendingTarget === "Ativos" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Enviar Clientes Ativos
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => handleSend("expired")}
              disabled={sending || !message.trim()}
            >
              {sending && sendingTarget === "Vencidos" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
              Enviar Clientes Vencidos
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ O envio possui controle anti-spam com intervalo entre mensagens para proteger seu número.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
