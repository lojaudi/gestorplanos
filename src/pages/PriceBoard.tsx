import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Download, RotateCcw, Upload, X, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { PriceBoardCanvas } from "@/components/priceboard/PriceBoardCanvas";
import { PriceBoardControls } from "@/components/priceboard/PriceBoardControls";
import { getLayout } from "@/components/priceboard/priceboard-layouts";
import type { PriceBoardState } from "@/components/priceboard/priceboard-types";
import { DEFAULT_PRODUCTS } from "@/components/priceboard/priceboard-types";

const INITIAL_STATE: PriceBoardState = {
  layoutId: "acougue-classico",
  title: "TABELA DE PREÇOS",
  subtitle: "OFERTA",
  highlightProduct: {
    name: "PICANHA KG",
    price: "49,90",
    unit: "KG",
    imageUrl: null,
  },
  products: DEFAULT_PRODUCTS,
  logoUrl: null,
  showDate: true,
  highlightSize: 35,
};

export default function PriceBoard() {
  const [state, setState] = useState<PriceBoardState>(INITIAL_STATE);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const productImageRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const layout = getLayout(state.layoutId);

  const handleFileSelect = useCallback(
    (type: "product" | "logo") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (type === "product") {
          setState((s) => ({ ...s, highlightProduct: { ...s.highlightProduct, imageUrl: url } }));
        } else {
          setState((s) => ({ ...s, logoUrl: url }));
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const handleExport = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(canvasRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: canvasRef.current.offsetWidth,
        height: canvasRef.current.offsetHeight,
      });
      const link = document.createElement("a");
      link.download = `tabela-precos-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Imagem exportada!", description: "A tabela de preços foi baixada como imagem." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    setState(INITIAL_STATE);
    toast({ title: "Redefinido!", description: "Todos os campos foram restaurados." });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tabela de Preços</h1>
          <p className="text-sm text-muted-foreground">
            Crie tabelas de preços profissionais para seu negócio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Redefinir
          </Button>
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar PNG
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Canvas preview */}
        <Card className="overflow-hidden">
          <PriceBoardCanvas
            ref={canvasRef}
            state={state}
            layout={layout}
            onProductImageClick={() => productImageRef.current?.click()}
            onLogoClick={() => logoRef.current?.click()}
          />
        </Card>

        {/* Controls sidebar */}
        <Card className="lg:max-h-[calc(100vh-200px)] overflow-hidden">
          <PriceBoardControls state={state} onChange={setState} />
        </Card>
      </div>

      {/* Hidden file inputs */}
      <input ref={productImageRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect("product")} />
      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect("logo")} />

      {/* Image management buttons */}
      {(state.highlightProduct.imageUrl || state.logoUrl) && (
        <div className="flex flex-wrap gap-2">
          {state.highlightProduct.imageUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  highlightProduct: { ...s.highlightProduct, imageUrl: null },
                }))
              }
            >
              <X className="mr-1 h-3 w-3" /> Remover Foto Produto
            </Button>
          )}
          {state.logoUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState((s) => ({ ...s, logoUrl: null }))}
            >
              <X className="mr-1 h-3 w-3" /> Remover Logo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
