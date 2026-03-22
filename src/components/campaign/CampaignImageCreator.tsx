import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wand2, Loader2, Upload, Save, GripVertical, X, Image as ImageIcon } from "lucide-react";

interface Props {
  onImageReady: (file: File, previewUrl: string) => void;
}

export function CampaignImageCreator({ onImageReady }: Props) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState({ x: 20, y: 20 });
  const [logoSize, setLogoSize] = useState(80);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedImages, setSavedImages] = useState<{ name: string; url: string }[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Load saved images
  const loadSavedImages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.storage.from("platform-assets").list(`campaign-ai/${user.id}`, { sortBy: { column: "created_at", order: "desc" } });
    if (data) {
      setSavedImages(data.map((f) => ({
        name: f.name,
        url: supabase.storage.from("platform-assets").getPublicUrl(`campaign-ai/${user.id}/${f.name}`).data.publicUrl,
      })));
    }
  }, [user]);

  useEffect(() => { loadSavedImages(); }, [loadSavedImages]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-image", {
        body: { prompt: prompt.trim() },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if (!data?.imageUrl) throw new Error("Nenhuma imagem gerada");
      setGeneratedImage(data.imageUrl);
      toast({ title: "Imagem gerada!", description: "Agora você pode adicionar uma logo e usar na campanha." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar imagem", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Drag logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left - logoPos.x, y: e.clientY - rect.top - logoPos.y };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - logoSize, e.clientX - rect.left - dragOffset.current.x));
    const y = Math.max(0, Math.min(rect.height - logoSize, e.clientY - rect.top - dragOffset.current.y));
    setLogoPos({ x, y });
  };

  const handlePointerUp = () => setDragging(false);

  // Compose final image on canvas and return as File
  const composeFinalImage = useCallback(async (): Promise<File | null> => {
    if (!generatedImage) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    bgImg.src = generatedImage;

    await new Promise<void>((res, rej) => { bgImg.onload = () => res(); bgImg.onerror = rej; });

    canvas.width = bgImg.naturalWidth;
    canvas.height = bgImg.naturalHeight;
    ctx.drawImage(bgImg, 0, 0);

    if (logoUrl && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const scaleX = bgImg.naturalWidth / containerRect.width;
      const scaleY = bgImg.naturalHeight / containerRect.height;

      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = logoUrl;
      await new Promise<void>((res, rej) => { logoImg.onload = () => res(); logoImg.onerror = rej; });

      ctx.drawImage(logoImg, logoPos.x * scaleX, logoPos.y * scaleY, logoSize * scaleX, logoSize * scaleY);
    }

    return new Promise((res) => {
      canvas.toBlob((blob) => {
        if (!blob) return res(null);
        res(new File([blob], `campaign-ai-${Date.now()}.png`, { type: "image/png" }));
      }, "image/png");
    });
  }, [generatedImage, logoUrl, logoPos, logoSize]);

  const handleUseInCampaign = async () => {
    const file = await composeFinalImage();
    if (!file) return;
    const url = URL.createObjectURL(file);
    onImageReady(file, url);
    toast({ title: "Imagem pronta!", description: "A imagem foi adicionada à campanha." });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const file = await composeFinalImage();
      if (!file) throw new Error("Erro ao compor imagem");
      const path = `campaign-ai/${user.id}/${file.name}`;
      const { error } = await supabase.storage.from("platform-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      toast({ title: "Imagem salva!", description: "Disponível na galeria para reutilizar." });
      loadSavedImages();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSaved = (url: string) => {
    setGeneratedImage(url);
    setLogoUrl(null);
    setLogoFile(null);
    setLogoPos({ x: 20, y: 20 });
    setShowGallery(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-5 w-5" />
          Criar Imagem com I.A
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt */}
        <div className="flex gap-2">
          <Input
            placeholder="Descreva a imagem que deseja gerar..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Gallery toggle */}
        <Button variant="outline" size="sm" onClick={() => { setShowGallery(!showGallery); if (!showGallery) loadSavedImages(); }}>
          <ImageIcon className="mr-2 h-4 w-4" />
          {showGallery ? "Fechar Galeria" : "Galeria Salvas"}
        </Button>

        {showGallery && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto rounded-lg border p-2">
            {savedImages.length === 0 && <p className="col-span-full text-sm text-muted-foreground text-center py-4">Nenhuma imagem salva.</p>}
            {savedImages.map((img) => (
              <button key={img.name} onClick={() => handleSelectSaved(img.url)} className="rounded-md overflow-hidden border hover:ring-2 ring-primary transition-all">
                <img src={img.url} alt={img.name} className="w-full h-20 object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Preview with logo overlay */}
        {generatedImage && (
          <div className="space-y-3">
            <Label>Preview (arraste a logo para posicionar)</Label>
            <div
              ref={containerRef}
              className="relative rounded-lg overflow-hidden border bg-muted select-none"
              style={{ touchAction: "none" }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <img src={generatedImage} alt="Generated" className="w-full block" crossOrigin="anonymous" />
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="absolute cursor-grab active:cursor-grabbing rounded shadow-lg border-2 border-background/50"
                  style={{ left: logoPos.x, top: logoPos.y, width: logoSize, height: logoSize, objectFit: "contain" }}
                  onPointerDown={handlePointerDown}
                  draggable={false}
                />
              )}
            </div>

            {/* Logo controls */}
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {logoUrl ? "Trocar Logo" : "Adicionar Logo"}
              </Button>
              <Input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              {logoUrl && (
                <>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Tamanho:</Label>
                    <input type="range" min={30} max={200} value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-24" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setLogoUrl(null); setLogoFile(null); }}>
                    <X className="mr-1 h-3 w-3" /> Remover
                  </Button>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleUseInCampaign} className="flex-1">
                <ImageIcon className="mr-2 h-4 w-4" />
                Usar na Campanha
              </Button>
              <Button variant="secondary" onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar na Galeria
              </Button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </CardContent>
    </Card>
  );
}
