import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Trash2, Save } from "lucide-react";

interface FootballUserConfig {
  id?: string;
  logo_url: string | null;
  whatsapp_number: string;
  custom_title: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
}

interface Props {
  config: FootballUserConfig;
  setConfig: (config: FootballUserConfig) => void;
  onSave: () => void;
  saving: boolean;
  uploadingLogo: boolean;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function GamesDayConfigSection({ config, setConfig, onSave, saving, uploadingLogo, onLogoUpload }: Props) {
  const logoRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Personalização do Banner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo personalizada</Label>
            {config.logo_url && (
              <div className="flex items-center gap-2">
                <img src={config.logo_url} alt="Logo" className="h-12 w-auto rounded border object-contain bg-muted p-1" />
                <Button variant="ghost" size="icon" onClick={() => setConfig({ ...config, logo_url: null })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
            <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
              {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploadingLogo ? "Enviando..." : "Enviar Logo"}
            </Button>
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <Label>WhatsApp (aparece no banner)</Label>
            <Input
              value={config.whatsapp_number}
              onChange={(e) => setConfig({ ...config, whatsapp_number: e.target.value })}
              placeholder="(11) 99999-9999"
              maxLength={20}
            />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label>Título do banner</Label>
          <Input
            value={config.custom_title}
            onChange={(e) => setConfig({ ...config, custom_title: e.target.value })}
            placeholder="Jogos de Hoje"
          />
        </div>

        {/* Colors */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Cor Primária</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.primary_color || "#1e3a5f"} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
              <Input value={config.primary_color || ""} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="flex-1" placeholder="#1e3a5f" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor Secundária</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.secondary_color || "#ffffff"} onChange={(e) => setConfig({ ...config, secondary_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
              <Input value={config.secondary_color || ""} onChange={(e) => setConfig({ ...config, secondary_color: e.target.value })} className="flex-1" placeholder="#ffffff" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor Destaque</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.accent_color || "#f59e0b"} onChange={(e) => setConfig({ ...config, accent_color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border" />
              <Input value={config.accent_color || ""} onChange={(e) => setConfig({ ...config, accent_color: e.target.value })} className="flex-1" placeholder="#f59e0b" />
            </div>
          </div>
        </div>

        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
