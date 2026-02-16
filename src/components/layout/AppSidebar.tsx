import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  Shield,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clientes", path: "/clients" },
  { icon: Briefcase, label: "Serviços", path: "/services" },
  { icon: CreditCard, label: "Planos", path: "/plans" },
  { icon: FileText, label: "Templates", path: "/templates" },
  { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp" },
  { icon: CreditCard, label: "Cobranças", path: "/billing" },
  { icon: CreditCard, label: "Gateway Pagamento", path: "/payment-gateway" },
  { icon: Settings, label: "Logs de Envio", path: "/logs" },
  { icon: UserCog, label: "Meu Perfil", path: "/profile" },
];

const adminItems = [
  { icon: Shield, label: "Usuários", path: "/admin/users" },
];

export function AppSidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url || null);
          setFullName(data.full_name || "");
        }
      });
  }, [user]);

  const initials = (fullName || user?.email?.[0] || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <MessageSquare className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-sidebar-primary-foreground">CobrançaZap</h1>
          <p className="text-xs text-sidebar-foreground/60">Gestão de Cobranças</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              location.pathname === item.path
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Admin
            </p>
            {adminItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  location.pathname === item.path
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2 px-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || undefined} alt={fullName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {fullName && <p className="text-xs font-medium text-sidebar-foreground truncate">{fullName}</p>}
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
