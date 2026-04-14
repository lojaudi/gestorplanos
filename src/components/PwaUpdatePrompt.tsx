import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    const checkWaiting = async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;

      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    checkWaiting();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
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
