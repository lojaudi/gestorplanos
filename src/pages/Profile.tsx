import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AvatarUpload } from "@/components/AvatarUpload";

const Profile = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setFullName(data.full_name || "");
      setAvatarUrl(data.avatar_url || null);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast({ title: "O campo Nome Completo é obrigatório", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      // Update name in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        toast({ title: "Um e-mail de confirmação foi enviado para o novo endereço" });
      } else {
        toast({ title: "Perfil atualizado com sucesso" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao atualizar perfil", description: err.message, variant: "destructive" });
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Senha alterada com sucesso" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          Meu Perfil
        </h1>
        <p className="text-muted-foreground">Gerencie seus dados pessoais</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <AvatarUpload
              userId={user?.id || ""}
              avatarUrl={avatarUrl}
              fullName={fullName}
              onUploaded={(url) => setAvatarUrl(url)}
              onRemoved={() => setAvatarUrl(null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            <Save className="mr-2 h-4 w-4" />
            {savingProfile ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword}>
            <Lock className="mr-2 h-4 w-4" />
            {savingPassword ? "Alterando..." : "Alterar Senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
