import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Crown } from "lucide-react";

interface PlanGuardProps {
  children: React.ReactNode;
}

export default function PlanGuard({ children }: PlanGuardProps) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pages that should always be accessible even with expired plan
  const allowedPaths = ["/subscribe", "/profile", "/pay"];
  const isAllowed = allowedPaths.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!user || isAdmin || isAllowed) {
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("plan_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.plan_expires_at) {
        const expiresAt = new Date(data.plan_expires_at);
        setExpired(expiresAt < new Date());
      } else {
        // NULL = legacy user, no expiry
        setExpired(false);
      }
      setLoading(false);
    };

    check();
  }, [user, isAdmin, isAllowed, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (expired && !isAllowed && !isAdmin) {
    return (
      <>
        {children}
        <AlertDialog open>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <AlertDialogTitle className="text-center">Plano Expirado</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Seu plano atual expirou. Para continuar utilizando a plataforma, escolha um novo plano.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction onClick={() => navigate("/subscribe")}>
                <Crown className="mr-2 h-4 w-4" />
                Escolher Plano
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return <>{children}</>;
}
