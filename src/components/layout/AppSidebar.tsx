import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  UserCog,
  ChevronDown,
  Wallet,
  Sun,
  Moon,
  FileText,
  Megaphone,
  Crown,
  ClipboardList,
  Globe,
  Video,
  BookOpen,
  MessageSquare,
  UserPlus,
  BarChart3,
  ChevronLeft,
  TrendingUp,
} from "lucide-react";
import { useCashflowAccess } from "@/hooks/useCashflowAccess";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
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

function buildUserNav(showCashflow: boolean): NavEntry[] {
  const nav: NavEntry[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Clientes", path: "/clients" },
    { icon: ClipboardList, label: "Logs de Envio", path: "/logs" },
    { icon: CreditCard, label: "Faturamento", path: "/billing" },
  ];
  if (showCashflow) {
    nav.push({ icon: TrendingUp, label: "Fluxo de Caixa", path: "/cashflow" });
  }
  nav.push(
    { icon: BarChart3, label: "Relatórios", path: "/reports" },
    { icon: Megaphone, label: "Campanhas", path: "/campaign" },
    {
      label: "Configurações",
      icon: Settings,
      items: [
        { icon: UserCog, label: "Meu Perfil", path: "/profile" },
        { icon: CreditCard, label: "Planos", path: "/plans" },
        { icon: FileText, label: "Templates", path: "/templates" },
        { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp" },
        { icon: Wallet, label: "Gateway Pagamentos", path: "/payment-gateway" },
        { icon: ClipboardList, label: "Serviços", path: "/services" },
      ],
    },
    { icon: Video, label: "Tutoriais", path: "/tutorials" },
    { icon: BookOpen, label: "Material de Apoio", path: "/support-materials" },
    { icon: Crown, label: "Meu Plano", path: "/subscribe" },
  );
  return nav;
}

const adminNav: NavEntry[] = [
  { icon: UserCog, label: "Meu Perfil", path: "/profile" },
  {
    label: "Configurações",
    icon: Settings,
    items: [
      { icon: Settings, label: "Configuração Geral", path: "/admin/settings" },
      { icon: Globe, label: "Config. WhatsApp Global", path: "/admin/settings" },
      { icon: Video, label: "Gerenciamento de Tutoriais", path: "/admin/tutorials" },
      { icon: ClipboardList, label: "Logs Globais", path: "/admin/logs" },
    ],
  },
  {
    label: "Usuários",
    icon: Shield,
    items: [
      { icon: Users, label: "Gerenciar Usuários", path: "/admin/users" },
      { icon: UserPlus, label: "Criar Planos Usuários", path: "/admin/plans" },
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
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <item.icon className={cn("h-[16px] w-[16px] shrink-0 transition-colors", active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
      <span className="truncate">{item.label}</span>
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
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200">
        <group.icon className="h-[16px] w-[16px] shrink-0 text-sidebar-foreground/40" />
        <span className="truncate">{group.label}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-sidebar-foreground/30 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-3 space-y-0.5 mt-0.5">
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
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const platform = usePlatformSettings();
  const { enabled: cashflowEnabled } = useCashflowAccess();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const userNav = buildUserNav(cashflowEnabled);

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
    <aside className="flex h-screen w-[260px] flex-col bg-sidebar text-sidebar-foreground overflow-hidden border-r border-sidebar-border/50">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-5">
        {platform.logo_url ? (
          <img
            src={platform.logo_url}
            alt={platform.system_name}
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        ) : (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 shadow-lg shadow-primary/25">
              <BarChart3 className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">
                {platform.system_name}
              </h1>
              <p className="text-[10px] font-medium text-sidebar-foreground/35 uppercase tracking-wider">CRM & Gestão</p>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5 scrollbar-thin">
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25">
            Menu
          </p>
          <NavSection
            entries={userNav}
            currentPath={location.pathname}
            onNavigate={navigate}
          />
        </div>

        {isAdmin && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25">
              Admin
            </p>
            <NavSection
              entries={adminNav}
              currentPath={location.pathname}
              onNavigate={navigate}
            />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border/50 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 bg-sidebar-accent/50">
          <Avatar className="h-8 w-8 ring-2 ring-sidebar-primary/20">
            <AvatarImage src={avatarUrl || undefined} alt={fullName} />
            <AvatarFallback className="text-[10px] font-semibold bg-sidebar-primary/20 text-sidebar-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {fullName && (
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {fullName}
              </p>
            )}
            <p className="text-[10px] text-sidebar-foreground/40 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground text-xs"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
            {theme === "dark" ? "Claro" : "Escuro"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive text-xs"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
}
