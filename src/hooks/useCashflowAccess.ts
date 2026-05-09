import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCashflowAccess() {
  const { user, isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    if (isAdmin) {
      setEnabled(true);
      setLoading(false);
      return;
    }
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("admin_plan_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.admin_plan_id) {
        setEnabled(false);
        setLoading(false);
        return;
      }
      const { data: plan } = await supabase
        .from("admin_plans")
        .select("module_cashflow")
        .eq("id", profile.admin_plan_id)
        .maybeSingle();

      setEnabled(!!plan?.module_cashflow);
      setLoading(false);
    })();
  }, [user, isAdmin]);

  return { enabled, loading };
}
