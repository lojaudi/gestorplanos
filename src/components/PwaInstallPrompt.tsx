import { useState, useEffect } from "react";
import { X, Download, Smartphone, Zap, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show on mobile-sized screens
      if (window.innerWidth < 768) {
        setVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 animate-in slide-in-from-bottom duration-400">
      <div className="relative mx-auto max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Download className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              Instale nosso app
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tenha acesso rápido direto da tela inicial do seu celular.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-[11px] text-center text-muted-foreground leading-tight">Mais rápido</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="text-[11px] text-center text-muted-foreground leading-tight">Tela cheia</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <Wifi className="h-4 w-4 text-primary" />
            <span className="text-[11px] text-center text-muted-foreground leading-tight">Acesso fácil</span>
          </div>
        </div>

        <Button onClick={handleInstall} className="mt-4 w-full" size="lg">
          <Download className="mr-2 h-4 w-4" />
          Instalar Agora
        </Button>
      </div>
    </div>
  );
}
