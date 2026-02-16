import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  size?: "sm" | "lg";
  onUploaded?: (url: string) => void;
  onRemoved?: () => void;
  editable?: boolean;
}

export function AvatarUpload({
  userId,
  avatarUrl,
  fullName,
  size = "lg",
  onUploaded,
  onRemoved,
  editable = true,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = (fullName || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = size === "lg" ? "h-24 w-24 text-2xl" : "h-9 w-9 text-xs";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione um arquivo de imagem", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "A imagem deve ter no máximo 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      onUploaded?.(url);
      toast({ title: "Foto atualizada com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      // List and remove all files in user folder
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(userId);

      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from("avatars").remove(paths);
      }

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", userId);

      if (error) throw error;

      onRemoved?.();
      toast({ title: "Foto removida com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err.message, variant: "destructive" });
    }
    setRemoving(false);
  };

  const busy = uploading || removing;

  return (
    <div className="relative inline-block">
      <Avatar className={sizeClass}>
        <AvatarImage src={avatarUrl || undefined} alt={fullName} />
        <AvatarFallback className={sizeClass}>{initials}</AvatarFallback>
      </Avatar>
      {editable && (
        <div className="absolute -bottom-1 -right-1 flex gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={busy}
          />
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full shadow-md"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </Button>
          {avatarUrl && (
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={handleRemove}
              disabled={busy}
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
