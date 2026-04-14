import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const detect = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      // If there's already a waiting worker
      if (reg.waiting) {
        setRegistration(reg);
        setShowUpdate(true);
        return;
      }

      // Listen for new service workers
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(reg);
            setShowUpdate(true);
          }
        });
      });

      // Also check periodically for updates (every 60s)
      const interval = setInterval(() => {
        reg.update().catch(() => {});
      }, 60 * 1000);

      return () => clearInterval(interval);
    };

    detect();
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // Reload after a brief delay to let the new SW activate
    setTimeout(() => window.location.reload(), 300);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-lg max-w-md w-full">
        <RefreshCw className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm text-foreground flex-1">
          Nova versão disponível!
        </p>
        <Button size="sm" onClick={handleUpdate}>
          Atualizar
        </Button>
      </div>
    </div>
  );
}
