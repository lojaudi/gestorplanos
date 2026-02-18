import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Eye, EyeOff, Loader2, ArrowLeft, Mail } from "lucide-react";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";

const Auth = () => {
  const platform = usePlatformSettings();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handlePasswordChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    setPassword(cleaned);
  };
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const whatsappEnabled = platform.whatsapp_verification_enabled;
  const emailEnabled = platform.email_verification_enabled;

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    setPhone(cleaned);
  };

  const handleSendVerification = async () => {
    if (!fullName || !email || !password) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (whatsappEnabled && (!phone || phone.length < 12 || phone.length > 13)) {
      toast({ title: "Erro", description: "Número inválido. Use o formato: 55 + DDD + número (ex: 5511999999999)", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 6 números", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(password)) {
      toast({ title: "Erro", description: "A senha deve conter apenas números", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (whatsappEnabled) {
        // WhatsApp verification flow
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({
              action: "send-verification-code",
              phone,
              email,
              full_name: fullName,
              password,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao enviar código");

        setVerificationStep(true);
        toast({ title: "Código enviado!", description: "Verifique seu WhatsApp e insira o código de 4 dígitos." });
      } else if (emailEnabled) {
        // Email verification flow - create account with email confirmation required
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone: phone || undefined },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        setEmailSent(true);
        toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para confirmar o cadastro." });
      } else {
        // No verification - create account directly (auto-confirmed)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone: phone || undefined },
          },
        });
        if (error) throw error;

        // Update profile with phone if provided
        const { data: { user } } = await supabase.auth.getUser();
        if (user && phone) {
          await supabase.from("profiles").update({ phone }).eq("user_id", user.id);
        }

        toast({ title: "Conta criada!", description: "Seu cadastro foi realizado com sucesso." });
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (verificationCode.length < 4) {
      toast({ title: "Erro", description: "Insira o código completo de 4 dígitos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ action: "verify-code", email, code: verificationCode }),
        }
      );
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Código inválido");

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone },
        },
      });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ phone }).eq("user_id", user.id);
      }

      toast({ title: "Conta criada!", description: "Seu cadastro foi verificado com sucesso." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      handleLogin(e);
    } else {
      handleSendVerification();
    }
  };

  const getSubmitLabel = () => {
    if (isLogin) return "Entrar";
    if (whatsappEnabled) return "Enviar Código de Verificação";
    if (emailEnabled) return "Criar Conta e Verificar E-mail";
    return "Criar Conta";
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background bg-cover bg-center bg-no-repeat p-4"
      style={platform.login_bg_url ? { backgroundImage: `url(${platform.login_bg_url})` } : undefined}
    >
      <Card className="w-full max-w-md backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center">
          {platform.logo_url ? (
            <img src={platform.logo_url} alt={platform.system_name} className="h-14 w-auto max-w-[180px] object-contain mx-auto mb-4" />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <MessageSquare className="h-7 w-7 text-primary-foreground" />
            </div>
          )}
          <CardTitle className="text-2xl">
            {verificationStep
              ? "Verificação WhatsApp"
              : emailSent
                ? "Verifique seu E-mail"
                : isLogin
                  ? "Entrar"
                  : "Criar Conta"}{" "}
            {!verificationStep && !emailSent && `- ${platform.system_name}`}
          </CardTitle>
          <CardDescription>
            {verificationStep
              ? "Insira o código de 4 dígitos enviado para seu WhatsApp"
              : emailSent
                ? "Enviamos um link de confirmação para o seu e-mail"
                : isLogin
                  ? "Acesse sua conta para gerenciar cobranças"
                  : "Crie sua conta para começar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Clique no link do e-mail para ativar sua conta. Depois, volte aqui para fazer login.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmailSent(false);
                  setIsLogin(true);
                }}
              >
                Ir para Login
              </Button>
            </div>
          ) : verificationStep ? (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={verificationCode} onChange={setVerificationCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Código enviado para <span className="font-medium text-foreground">{phone}</span>
              </p>
              <Button className="w-full" onClick={handleVerifyAndRegister} disabled={loading || verificationCode.length < 4}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : "Confirmar e Criar Conta"}
              </Button>
              <div className="flex justify-between">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                  onClick={() => { setVerificationStep(false); setVerificationCode(""); }}
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={handleSendVerification}
                  disabled={loading}
                >
                  Reenviar código
                </button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Seu nome completo"
                        required
                      />
                    </div>
                    {whatsappEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="phone">WhatsApp</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          placeholder="5511999999999"
                          required
                          maxLength={13}
                        />
                        <p className="text-xs text-muted-foreground">Formato: 55 + DDD + número (ex: 5511999999999)</p>
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="••••••"
                      required
                      minLength={6}
                      inputMode="numeric"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isLogin && (
                    <p className="text-xs text-muted-foreground">Apenas números, mínimo 6 dígitos</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</> : getSubmitLabel()}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
