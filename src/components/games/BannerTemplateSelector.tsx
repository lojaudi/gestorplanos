import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TemplateType = "modern" | "sporty" | "minimal";

const templates: { id: TemplateType; name: string; description: string }[] = [
  { id: "modern", name: "Moderno", description: "Gradiente escuro, grid 2×3" },
  { id: "sporty", name: "Esportivo", description: "Textura dinâmica, badges" },
  { id: "minimal", name: "Minimalista", description: "Limpo, tipografia forte" },
];

interface Props {
  selected: TemplateType;
  onChange: (t: TemplateType) => void;
}

export function BannerTemplateSelector({ selected, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Modelo do Banner</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "rounded-lg border-2 p-4 text-left transition-all",
                selected === t.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="mb-2 h-20 rounded-md flex items-center justify-center text-3xl" style={{
                background: t.id === "modern"
                  ? "linear-gradient(135deg, #0f172a, #1e3a5f)"
                  : t.id === "sporty"
                  ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                  : "#fafafa",
                color: t.id === "minimal" ? "#111" : "#fff",
              }}>
                {t.id === "modern" ? "⚽" : t.id === "sporty" ? "🏟️" : "⚽"}
              </div>
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
