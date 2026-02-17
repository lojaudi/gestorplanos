import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Upload, Loader2, Trash2, Save } from "lucide-react";

interface TmdbConfig {
  id: string;
  user_id: string;
  api_key: string;
  logo_url: string | null;
}

interface Props {
  apiKey: string;
  setApiKey: (v: string) => void;
  config: TmdbConfig | null;
  setConfig: React.Dispatch<React.SetStateAction<TmdbConfig | null>>;
  saving: boolean;
  onSave: () => void;
  uploadingLogo: boolean;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TmdbConfigSection({
  apiKey,
  setApiKey,
  config,
  setConfig,
  saving,
  onSave,
  uploadingLogo,
  onLogoUpload,
}: Props) {
  const logoRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-4 w-4" /> API Key TMDB
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Obtenha sua chave em{" "}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                themoviedb.org
              </a>
            </p>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Insira sua API Key"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-4 w-4" /> Logotipo do Banner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config?.logo_url && (
              <div className="flex items-center gap-3">
                <img
                  src={config.logo_url}
                  alt="Logo"
                  className="h-16 w-auto rounded border object-contain bg-muted p-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setConfig((prev) =>
                      prev ? { ...prev, logo_url: null } : prev
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onLogoUpload}
            />
            <Button
              variant="outline"
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploadingLogo ? "Enviando..." : "Enviar Logo"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button onClick={onSave} disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Salvando..." : "Salvar Configuração"}
      </Button>
    </>
  );
}
