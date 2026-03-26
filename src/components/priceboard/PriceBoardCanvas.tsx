import { forwardRef } from "react";
import type { PriceBoardState, PriceBoardLayout } from "./priceboard-types";
import { getLayout } from "./priceboard-layouts";

interface Props {
  state: PriceBoardState;
  layout: PriceBoardLayout;
  onProductImageClick?: () => void;
  onLogoClick?: () => void;
}

export const PriceBoardCanvas = forwardRef<HTMLDivElement, Props>(
  ({ state, layout, onProductImageClick, onLogoClick }, ref) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    return (
      <div
        ref={ref}
        className="relative overflow-hidden select-none"
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: layout.bgGradient,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        {/* Main layout: highlight left + table right */}
        <div className="flex h-full w-full">
          {/* LEFT: Highlight Product */}
          <div
            className="flex flex-col items-center justify-center relative"
            style={{
              width: `${state.highlightSize}%`,
              background: layout.highlightBg,
              padding: "3%",
            }}
          >
            {/* Logo top */}
            {state.logoUrl && (
              <div
                className="absolute cursor-pointer hover:opacity-80 transition-opacity"
                style={{ top: "4%", left: "50%", transform: "translateX(-50%)" }}
                onClick={onLogoClick}
              >
                <img
                  src={state.logoUrl}
                  alt="Logo"
                  className="max-h-[15%] max-w-[60%] object-contain"
                  style={{ maxHeight: "10vh" }}
                  crossOrigin="anonymous"
                />
              </div>
            )}

            {/* Highlight title */}
            {state.subtitle && (
              <div
                className="text-center font-black uppercase tracking-wider mb-1"
                style={{
                  color: layout.priceBadgeBg,
                  fontSize: "clamp(10px, 2vw, 22px)",
                  textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
                }}
              >
                {state.subtitle}
              </div>
            )}

            {/* Product name */}
            <div
              className="text-center font-black uppercase leading-tight"
              style={{
                color: layout.highlightTextColor,
                fontSize: "clamp(14px, 3vw, 32px)",
                textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
              }}
            >
              {state.highlightProduct.name}
            </div>

            {/* Product image */}
            <div
              className="relative my-2 cursor-pointer hover:scale-105 transition-transform"
              onClick={onProductImageClick}
              style={{ width: "70%", aspectRatio: "4/3" }}
            >
              {state.highlightProduct.imageUrl ? (
                <img
                  src={state.highlightProduct.imageUrl}
                  alt={state.highlightProduct.name}
                  className="w-full h-full object-contain drop-shadow-2xl rounded-lg"
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  className="w-full h-full rounded-lg flex items-center justify-center border-2 border-dashed"
                  style={{ borderColor: "rgba(255,255,255,0.4)", color: "rgba(255,255,255,0.5)" }}
                >
                  <div className="text-center">
                    <div style={{ fontSize: "clamp(20px, 4vw, 48px)" }}>📷</div>
                    <div style={{ fontSize: "clamp(8px, 1vw, 12px)" }}>Clique para adicionar</div>
                  </div>
                </div>
              )}
            </div>

            {/* Price badge */}
            <div
              className="rounded-xl px-4 py-2 text-center shadow-lg"
              style={{
                background: layout.priceBadgeBg,
                transform: "rotate(-2deg)",
              }}
            >
              <div
                className="font-medium"
                style={{
                  color: layout.priceBadgeColor,
                  fontSize: "clamp(8px, 1.2vw, 14px)",
                }}
              >
                R$
              </div>
              <div
                className="font-black leading-none"
                style={{
                  color: layout.priceBadgeColor,
                  fontSize: "clamp(20px, 5vw, 56px)",
                }}
              >
                {state.highlightProduct.price}
              </div>
              <div
                className="font-bold uppercase"
                style={{
                  color: layout.priceBadgeColor,
                  fontSize: "clamp(8px, 1.2vw, 14px)",
                  opacity: 0.7,
                }}
              >
                {state.highlightProduct.unit}
              </div>
            </div>
          </div>

          {/* RIGHT: Price Table */}
          <div className="flex-1 flex flex-col" style={{ padding: "2% 3%" }}>
            {/* Header */}
            <div
              className="text-center py-2 rounded-t-lg font-black uppercase tracking-wider"
              style={{
                background: layout.headerBg,
                color: layout.headerColor,
                fontSize: "clamp(12px, 2.5vw, 28px)",
                letterSpacing: "0.05em",
              }}
            >
              {state.title}
            </div>

            {/* Product rows */}
            <div className="flex-1 flex flex-col">
              {state.products.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 border-b"
                  style={{
                    flex: 1,
                    background: i % 2 === 0 ? layout.rowBg : layout.rowAltBg,
                    borderColor: layout.tableBorderColor,
                  }}
                >
                  <span
                    className="font-bold uppercase truncate"
                    style={{
                      color: layout.rowTextColor,
                      fontSize: "clamp(10px, 1.8vw, 20px)",
                      flex: 1,
                    }}
                  >
                    {p.name} {p.unit}
                  </span>
                  <span
                    className="font-black whitespace-nowrap ml-2"
                    style={{
                      color: layout.priceColor,
                      fontSize: "clamp(10px, 2vw, 22px)",
                    }}
                  >
                    R$ {p.price}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            {state.showDate && (
              <div
                className="text-right py-1 pr-2"
                style={{
                  color: layout.rowTextColor,
                  opacity: 0.5,
                  fontSize: "clamp(6px, 0.8vw, 10px)",
                }}
              >
                Atualizado {dateStr}
              </div>
            )}
          </div>
        </div>

        {/* Add logo button overlay */}
        {!state.logoUrl && (
          <div
            className="absolute cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              top: "3%",
              left: `${state.highlightSize / 2}%`,
              transform: "translateX(-50%)",
            }}
            onClick={onLogoClick}
          >
            <div
              className="rounded-lg px-3 py-1 text-center border border-dashed flex items-center gap-1"
              style={{
                borderColor: "rgba(255,255,255,0.4)",
                color: "rgba(255,255,255,0.6)",
                fontSize: "clamp(7px, 1vw, 11px)",
                background: "rgba(0,0,0,0.3)",
              }}
            >
              + Logo
            </div>
          </div>
        )}
      </div>
    );
  }
);
PriceBoardCanvas.displayName = "PriceBoardCanvas";
