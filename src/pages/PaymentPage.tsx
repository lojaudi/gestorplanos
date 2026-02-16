import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, CheckCircle, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PaymentData {
  id: string;
  amount: number;
  description: string;
  status: string;
  qr_code_base64: string | null;
  pix_copy_paste: string | null;
  expires_at: string | null;
  client_name: string;
}

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("id");
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paymentId) {
      setError("Link de pagamento inválido");
      setLoading(false);
      return;
    }

    const fetchPayment = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/mercado-pago`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
          },
          body: JSON.stringify({ action: "get-payment", payment_id: paymentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar pagamento");
        setPayment(data);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };

    fetchPayment();
  }, [paymentId]);

  const handleCopy = async () => {
    if (!payment?.pix_copy_paste) return;
    await navigator.clipboard.writeText(payment.pix_copy_paste);
    setCopied(true);
    toast({ title: "Código Pix copiado!" });
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-destructive font-semibold">{error || "Pagamento não encontrado"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();
  const isPaid = payment.status === "paid";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Pagamento via Pix</CardTitle>
          {payment.client_name && (
            <p className="text-sm text-muted-foreground">{payment.client_name}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount */}
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">
              R$ {Number(payment.amount).toFixed(2).replace(".", ",")}
            </p>
            {payment.description && (
              <p className="mt-1 text-sm text-muted-foreground">{payment.description}</p>
            )}
          </div>

          {/* Status */}
          <div className="flex justify-center">
            {isPaid ? (
              <Badge className="bg-primary text-primary-foreground">
                <CheckCircle className="mr-1 h-3 w-3" /> Pago
              </Badge>
            ) : isExpired ? (
              <Badge variant="destructive">Expirado</Badge>
            ) : (
              <Badge variant="secondary">Aguardando Pagamento</Badge>
            )}
          </div>

          {!isPaid && !isExpired && (
            <>
              {/* QR Code */}
              {payment.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${payment.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="h-52 w-52 rounded-lg border"
                  />
                </div>
              )}

              {/* Copy Paste */}
              {payment.pix_copy_paste && (
                <div className="space-y-2">
                  <p className="text-center text-sm font-medium text-muted-foreground">
                    Ou copie o código Pix:
                  </p>
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="break-all text-xs text-muted-foreground font-mono">
                      {payment.pix_copy_paste}
                    </p>
                  </div>
                  <Button onClick={handleCopy} className="w-full" size="lg">
                    {copied ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" /> Copiar código Pix
                      </>
                    )}
                  </Button>
                </div>
              )}

              {payment.expires_at && (
                <p className="text-center text-xs text-muted-foreground">
                  Expira em:{" "}
                  {new Date(payment.expires_at).toLocaleString("pt-BR")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
