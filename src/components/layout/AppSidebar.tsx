import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  Settings,
  LogOut,
  Shield,
  UserCog,
  Video,
  ChevronDown,
  Wallet,
  FileText,
  Megaphone,
  Crown,
  UserPlus,
  ClipboardList,
  Globe,
  BookOpen,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  soon?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const userNav: NavEntry[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clientes", path: "/clients" },
  { icon: CreditCard, label: "Cobrança", path: "/billing" },
  { icon: Megaphone, label: "Campanhas", path: "/campaign" },
  { icon: Briefcase, label: "Serviços", path: "/services" },
  { icon: CreditCard, label: "Planos", path: "/plans" },
  {
    label: "Configurações",
    icon: Settings,
    items: [
      { icon: UserCog, label: "Meu Perfil", path: "/profile" },
      { icon: FileText, label: "Templates", path: "/templates" },
      { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp" },
      { icon: Wallet, label: "Gateway Pagamentos", path: "/payment-gateway" },
    ],
  },
  { icon: Video, label: "Tutoriais", path: "/tutorials" },
  { icon: BookOpen, label: "Material de Apoio", path: "/support-materials" },
  { icon: Crown, label: "Meu Plano", path: "/subscribe" },
];

const adminNav: NavEntry[] = [
  { icon: UserCog, label: "Meu Perfil", path: "/profile" },
  {
    label: "Configurações",
    icon: Settings,
    items: [
      { icon: Settings, label: "Configuração Geral", path: "/admin/settings" },
      { icon: Globe, label: "Config. WhatsApp Global", path: "/admin/settings" },
      { icon: Video, label: "Gerenciamento de Tutoriais", path: "/admin/tutorials" },
    ],
  },
  {
    label: "Usuários",
    icon: Shield,
    items: [
      { icon: Users, label: "Gerenciar Usuários", path: "/admin/users" },
      { icon: UserPlus, label: "Criar Planos Usuários", path: "/admin/plans" },
      { icon: ClipboardList, label: "Gerenciar Planos Usuários", path: "/admin/plans" },
      { icon: BookOpen, label: "Material de Apoio", path: "/admin/support-materials" },
    ],
  },
];

function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={item.soon ? undefined : onClick}
      disabled={item.soon}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
        item.soon
          ? "cursor-not-allowed text-sidebar-foreground/30"
          : active
          ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.soon && (
        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-sidebar-foreground/20 text-sidebar-foreground/40">
          Em Breve
        </Badge>
      )}
    </button>
  );
}

function SidebarGroupComponent({
  group,
  currentPath,
  onNavigate,
}: {
  group: NavGroup;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const hasActive = group.items.some((i) => i.path && currentPath === i.path);
  const [open, setOpen] = useState(hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150">
        <group.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{group.label}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
        {group.items.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            active={!!item.path && currentPath === item.path}
            onClick={() => item.path && onNavigate(item.path)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavSection({
  entries,
  currentPath,
  onNavigate,
}: {
  entries: NavEntry[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {entries.map((entry) =>
        isGroup(entry) ? (
          <SidebarGroupComponent
            key={entry.label}
            group={entry}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarItem
            key={entry.label}
            item={entry}
            active={!!entry.path && currentPath === entry.path}
            onClick={() => entry.path && onNavigate(entry.path)}
          />
        )
      )}
    </div>
  );
}

export function AppSidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const platform = usePlatformSettings();
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

  const initials = (fullName || user?.email?.[0] || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground overflow-hidden border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        {platform.logo_url ? (
          <img
            src={platform.logo_url}
            alt={platform.system_name}
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <MessageSquare className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sidebar-accent-foreground">
                {platform.system_name}
              </h1>
              <p className="text-[11px] text-sidebar-foreground/50">CRM</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
        <NavSection
          entries={userNav}
          currentPath={location.pathname}
          onNavigate={navigate}
        />

        {isAdmin && (
          <>
            <div className="border-t border-sidebar-border my-2" />
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
              Admin
            </p>
            <NavSection
              entries={adminNav}
              currentPath={location.pathname}
              onNavigate={navigate}
            />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || undefined} alt={fullName} />
            <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-accent-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {fullName && (
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                {fullName}
              </p>
            )}
            <p className="text-[11px] text-sidebar-foreground/40 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground text-xs"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
