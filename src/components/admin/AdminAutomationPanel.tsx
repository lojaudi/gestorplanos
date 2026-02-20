import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Power, PowerOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AutomationRow {
  user_id: string;
  is_enabled: boolean;
  notify_before_due: boolean;
  notify_on_due: boolean;
  notify_after_due: boolean;
  send_hour_before_due: number;
  send_hour_on_due: number;
  send_hour_after_due: number;
  userName: string;
  userEmail: string;
}

export function AdminAutomationPanel() {
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: configs }, { data: profiles }] = await Promise.all([
        supabase.from("billing_automation_config").select("*"),
        supabase.from("profiles").select("user_id, full_name, email"),
      ]);

      if (configs && profiles) {
        const profileMap = new Map(
          profiles.map((p) => [p.user_id, { name: p.full_name, email: p.email }])
        );

        const merged: AutomationRow[] = configs.map((c) => {
          const profile = profileMap.get(c.user_id);
          return {
            user_id: c.user_id,
            is_enabled: c.is_enabled,
            notify_before_due: c.notify_before_due,
            notify_on_due: c.notify_on_due,
            notify_after_due: c.notify_after_due,
            send_hour_before_due: c.send_hour_before_due,
            send_hour_on_due: c.send_hour_on_due,
            send_hour_after_due: c.send_hour_after_due,
            userName: profile?.name || "Sem nome",
            userEmail: profile?.email || "",
          };
        });

        setRows(merged);
      }
    } catch {
      toast({ title: "Erro ao carregar automações", variant: "destructive" });
    }
    setLoading(false);
  };

  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const enabledCount = rows.filter((r) => r.is_enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Automações de Cobrança</CardTitle>
          <Badge variant="secondary" className="ml-2">
            {enabledCount}/{rows.length} ativas
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum usuário configurou automação ainda
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Antes (1 dia)</TableHead>
                <TableHead>No Dia</TableHead>
                <TableHead>Após (1 dia)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{row.userName}</p>
                      <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.is_enabled ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                        <Power className="h-3 w-3" /> Ativa
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <PowerOff className="h-3 w-3" /> Inativa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.notify_before_due ? (
                      <Badge variant="secondary">{formatHour(row.send_hour_before_due)}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Desabilitado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.notify_on_due ? (
                      <Badge variant="secondary">{formatHour(row.send_hour_on_due)}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Desabilitado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.notify_after_due ? (
                      <Badge variant="secondary">{formatHour(row.send_hour_after_due)}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Desabilitado</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
