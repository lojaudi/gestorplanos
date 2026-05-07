import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlatformSettings {
  system_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  login_bg_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  whatsapp_verification_enabled: boolean;
  email_verification_enabled: boolean;
  landing_dark_mode: boolean;
}

const defaultSettings: PlatformSettings = {
  system_name: "CobrançaZap",
  logo_url: null,
  favicon_url: null,
  login_bg_url: null,
  primary_color: "#3b82f6",
  secondary_color: "#1e40af",
  accent_color: "#f59e0b",
  whatsapp_verification_enabled: true,
  email_verification_enabled: false,
  landing_dark_mode: false,
};

const PlatformSettingsContext = createContext<PlatformSettings>(defaultSettings);

export const usePlatformSettings = () => useContext(PlatformSettingsContext);

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyDynamicColors(settings: PlatformSettings) {
  const root = document.documentElement;
  const primaryHsl = hexToHsl(settings.primary_color);
  if (primaryHsl) {
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
    // Sidebar primary matches
    root.style.setProperty("--sidebar-primary", primaryHsl);
    root.style.setProperty("--sidebar-ring", primaryHsl);
  }
  const accentHsl = hexToHsl(settings.accent_color);
  if (accentHsl) {
    root.style.setProperty("--warning", accentHsl);
  }
}

function applyFavicon(url: string | null) {
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (url) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = url;
  }
}

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);

  useEffect(() => {
    supabase
      .from("platform_settings_public" as any)
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          const s: PlatformSettings = {
            system_name: data.system_name,
            logo_url: data.logo_url,
            favicon_url: data.favicon_url,
            login_bg_url: data.login_bg_url,
            primary_color: data.primary_color,
            secondary_color: data.secondary_color,
            accent_color: data.accent_color,
            whatsapp_verification_enabled: (data as any).whatsapp_verification_enabled ?? true,
            email_verification_enabled: (data as any).email_verification_enabled ?? false,
            landing_dark_mode: (data as any).landing_dark_mode ?? false,
          };
          setSettings(s);
          document.title = `${s.system_name} - Gestão de Cobranças`;
          applyFavicon(s.favicon_url);
          applyDynamicColors(s);
        }
      });
  }, []);

  return (
    <PlatformSettingsContext.Provider value={settings}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}
