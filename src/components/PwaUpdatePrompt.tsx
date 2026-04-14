import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerSW } from "virtual:pwa-register";

export function PwaUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");

    if (isInIframe || isPreviewHost) return;

    let intervalId: number | undefined;

    const recheckForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        await registration.update();

        if (registration.waiting) {
          setShowUpdate(true);
        }
      } catch {
        // ignore silent update check failures
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void recheckForUpdates();
      }
    };

    const handleControllerChange = () => {
      window.location.reload();
    };

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setShowUpdate(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        if (registration.waiting) {
          setShowUpdate(true);
        }

        void registration.update();

        intervalId = window.setInterval(() => {
          if (document.visibilityState === "visible") {
            void registration.update();
          }

          if (registration.waiting) {
            setShowUpdate(true);
          }
        }, 30 * 1000);
      },
    });

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("focus", recheckForUpdates);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void recheckForUpdates();

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }

      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("focus", recheckForUpdates);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleUpdate = async () => {
    if (!updateSWRef.current) return;

    setIsUpdating(true);

    try {
      await updateSWRef.current(true);
    } catch {
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-lg max-w-md w-full">
        <RefreshCw className={`h-5 w-5 text-primary shrink-0 ${isUpdating ? "animate-spin" : ""}`} />
        <p className="text-sm text-foreground flex-1">
          Nova versão disponível!
        </p>
        <Button size="sm" onClick={() => void handleUpdate()} disabled={isUpdating}>
          {isUpdating ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>
    </div>
  );
}
