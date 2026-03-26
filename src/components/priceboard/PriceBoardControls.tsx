import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { LAYOUTS } from "./priceboard-layouts";
import type { PriceBoardState, ProductRow } from "./priceboard-types";

interface Props {
  state: PriceBoardState;
  onChange: (s: PriceBoardState) => void;
}

export function PriceBoardControls({ state, onChange }: Props) {
  const update = (partial: Partial<PriceBoardState>) => onChange({ ...state, ...partial });

  const updateProduct = (id: string, field: keyof ProductRow, value: string) => {
    update({
      products: state.products.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    });
  };

  const addProduct = () => {
    if (state.products.length >= 10) return;
    update({
      products: [
        ...state.products,
        { id: String(Date.now()), name: "NOVO PRODUTO", price: "0,00", unit: "KG" },
      ],
    });
  };

  const removeProduct = (id: string) => {
    if (state.products.length <= 1) return;
    update({ products: state.products.filter((p) => p.id !== id) });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        {/* Layout selector */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            Layout
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => update({ layoutId: l.id })}
                className={`rounded-lg border-2 p-2 text-center transition-all text-xs font-medium ${
                  state.layoutId === l.id
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-lg mb-0.5">{l.thumbnail}</div>
                <div className="truncate">{l.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Título da Tabela
          </Label>
          <Input
            value={state.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Ex: CORTES BOVINOS"
          />
        </div>

        {/* Subtitle */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Subtítulo (etiqueta destaque)
          </Label>
          <Input
            value={state.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            placeholder="Ex: OFERTA"
          />
        </div>

        {/* Highlight product */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Produto em Destaque
          </Label>
          <Input
            value={state.highlightProduct.name}
            onChange={(e) =>
              update({ highlightProduct: { ...state.highlightProduct, name: e.target.value } })
            }
            placeholder="Nome do produto"
          />
          <div className="flex gap-2">
            <Input
              value={state.highlightProduct.price}
              onChange={(e) =>
                update({ highlightProduct: { ...state.highlightProduct, price: e.target.value } })
              }
              placeholder="Preço"
              className="flex-1"
            />
            <Input
              value={state.highlightProduct.unit}
              onChange={(e) =>
                update({ highlightProduct: { ...state.highlightProduct, unit: e.target.value } })
              }
              placeholder="Un."
              className="w-20"
            />
          </div>
        </div>

        {/* Highlight size slider */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tamanho do Destaque: {state.highlightSize}%
          </Label>
          <Slider
            value={[state.highlightSize]}
            min={25}
            max={50}
            step={1}
            onValueChange={([v]) => update({ highlightSize: v })}
          />
        </div>

        {/* Show date */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mostrar Data
          </Label>
          <Switch checked={state.showDate} onCheckedChange={(v) => update({ showDate: v })} />
        </div>

        {/* Product list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tabela de Preços ({state.products.length})
            </Label>
            <Button variant="outline" size="sm" onClick={addProduct} disabled={state.products.length >= 10}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-1.5">
            {state.products.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 group">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                <Input
                  value={p.name}
                  onChange={(e) => updateProduct(p.id, "name", e.target.value)}
                  className="flex-1 h-8 text-xs"
                  placeholder="Nome"
                />
                <Input
                  value={p.unit}
                  onChange={(e) => updateProduct(p.id, "unit", e.target.value)}
                  className="w-14 h-8 text-xs"
                  placeholder="Un."
                />
                <Input
                  value={p.price}
                  onChange={(e) => updateProduct(p.id, "price", e.target.value)}
                  className="w-20 h-8 text-xs"
                  placeholder="0,00"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => removeProduct(p.id)}
                  disabled={state.products.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
