import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2 } from "lucide-react";

interface SupportMaterial {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
}

const SupportMaterials = () => {
  const [materials, setMaterials] = useState<SupportMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("support_materials")
        .select("id, title, content, sort_order, created_at")
        .eq("is_published", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      setMaterials((data as SupportMaterial[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Material de Apoio</h1>
        <p className="text-muted-foreground">Materiais, modelos e informações úteis disponibilizados pelo administrador</p>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhum material de apoio disponível no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{m.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">{m.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportMaterials;
