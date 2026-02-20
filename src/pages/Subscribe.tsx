import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Crown, Check, MessageCircle, CreditCard, Loader2, Users, Calendar } from "lucide-react";

interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  max_clients: number;
  duration_months: number;
  module_campaigns: boolean;
  module_games: boolean;
  module_banners: boolean;
}

const durationLabels: Record<number, string> = {
  1: "Mensal",
  3: "Trimestral",
  6: "Semestral",
  12: "Anual",
};

const Subscribe = () => {
  const { user } = useAuth();
  const platform = usePlatformSettings();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [hasGateway, setHasGateway] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [plansRes, profileRes, adminRes, gatewayRes] = await Promise.all([
      supabase.from("admin_plans").select("*").eq("is_active", true).order("price"),
      supabase.from("profiles").select("admin_plan_id").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("profiles")
        .select("phone, user_id")
        .in("user_id", 
          supabase.from("user_roles").select("user_id").eq("role", "admin") as any
        ),
      // Check if any admin has gateway configured — we query via edge function
      null,
    ]);

    setPlans((plansRes.data as AdminPlan[]) || []);
    setCurrentPlanId(profileRes.data?.admin_plan_id || null);
    setLoading(false);

    // Get admin phone directly
    const { data: adminData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (adminData) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", adminData.user_id)
        .maybeSingle();
      setAdminPhone(adminProfile?.phone || null);

      // Check gateway config via edge function
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-pago`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ action: "check-admin-gateway", admin_user_id: adminData.user_id }),
          }
        );
        const json = await res.json();
        setHasGateway(json.has_gateway === true);
      } catch {
        setHasGateway(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePayMercadoPago = async (plan: AdminPlan) => {
    setProcessingId(plan.id);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-pago`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "create-admin-payment",
            plan_id: plan.id,
            plan_name: plan.name,
            amount: plan.price,
          }),
        }
      );
      const json = await res.json();
      if (json.payment_url) {
        window.open(json.payment_url, "_blank");
      } else if (json.pix_copy_paste) {
        // Show payment page
        const payUrl = `${window.location.origin}/pay?id=${json.payment_id}`;
        window.open(payUrl, "_blank");
      } else {
        toast({ title: "Erro ao gerar pagamento", description: json.error || "Tente novamente", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setProcessingId(null);
  };

  const handlePayWhatsApp = (plan: AdminPlan) => {
    if (!adminPhone) {
      toast({ title: "WhatsApp do administrador não configurado", variant: "destructive" });
      return;
    }

    const systemName = platform.system_name;
    const formattedPrice = plan.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const message = `Vim através da ${systemName}, efetuar o pagamento do plano ${plan.name} no valor de ${formattedPrice}.`;
    const phone = adminPhone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const modulesList = (p: AdminPlan) => {
    const m: string[] = [];
    if (p.module_campaigns) m.push("Campanha");
    if (p.module_games) m.push("Jogos do Dia");
    if (p.module_banners) m.push("Banners");
    return m;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Escolher Plano</h1>
        <p className="text-muted-foreground">Selecione o plano ideal para o seu negócio</p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Crown className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhum plano disponível no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const modules = modulesList(plan);

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${isCurrent ? "border-primary ring-2 ring-primary/20" : ""}`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3">
                    Plano Atual
                  </Badge>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.description && (
                    <CardDescription>{plan.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div>
                    <span className="text-3xl font-bold text-foreground">
                      {plan.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      /{durationLabels[plan.duration_months] || `${plan.duration_months}m`}
                    </span>
                  </div>

                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Até {plan.max_clients} clientes
                    </li>
                    <li className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {durationLabels[plan.duration_months] || `${plan.duration_months} meses`}
                    </li>
                    {modules.map((m) => (
                      <li key={m} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {m}
                      </li>
                    ))}
                    {modules.length === 0 && (
                      <li className="text-muted-foreground text-xs">Módulos básicos</li>
                    )}
                  </ul>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  {isCurrent ? (
                    <Button disabled className="w-full" variant="outline">
                      <Check className="mr-2 h-4 w-4" /> Plano Ativo
                    </Button>
                  ) : hasGateway ? (
                    <Button
                      className="w-full"
                      onClick={() => handlePayMercadoPago(plan)}
                      disabled={processingId === plan.id}
                    >
                      {processingId === plan.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      {processingId === plan.id ? "Gerando..." : "Pagar"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => handlePayWhatsApp(plan)}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Pagar no WhatsApp
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Subscribe;
