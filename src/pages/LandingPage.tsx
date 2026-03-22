import { useNavigate } from "react-router-dom";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Users,
  MessageSquare,
  CreditCard,
  Shield,
  Zap,
  CheckCircle2,
  Star,
  ChevronRight,
  Megaphone,
  Clock,
  Crown,
} from "lucide-react";

interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  max_clients: number;
  duration_months: number;
  module_campaigns: boolean;
  is_active: boolean;
}

const durationLabels: Record<number, string> = {
  0: "7 dias (Trial)",
  1: "Mensal",
  3: "Trimestral",
  6: "Semestral",
  12: "Anual",
};

const features = [
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Cadastre e organize todos os seus clientes com dados completos, planos e datas de vencimento em um só lugar.",
  },
  {
    icon: CreditCard,
    title: "Faturamento Inteligente",
    description: "Controle cobranças, acompanhe vencimentos e gere relatórios financeiros de forma automatizada.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Integrado",
    description: "Envie notificações, cobranças e mensagens personalizadas diretamente pelo WhatsApp dos seus clientes.",
  },
  {
    icon: Megaphone,
    title: "Campanhas em Massa",
    description: "Crie e dispare campanhas de mensagens para toda sua base de clientes com poucos cliques.",
  },
  {
    icon: Clock,
    title: "Agendamento Automático",
    description: "Configure cobranças automáticas antes, no dia e após o vencimento sem intervenção manual.",
  },
  {
    icon: Shield,
    title: "Segurança Total",
    description: "Seus dados protegidos com criptografia e autenticação segura em todas as operações.",
  },
];

const testimonials = [
  {
    name: "Carlos Silva",
    role: "Provedor de Internet",
    content: "Reduzi a inadimplência em 40% no primeiro mês. O envio automático pelo WhatsApp é sensacional!",
    stars: 5,
  },
  {
    name: "Ana Oliveira",
    role: "Gestora de IPTV",
    content: "Organizar meus 500+ clientes nunca foi tão fácil. A interface é intuitiva e profissional.",
    stars: 5,
  },
  {
    name: "Rafael Santos",
    role: "Revendedor Digital",
    content: "As campanhas em massa economizam horas do meu dia. Ferramenta indispensável para o negócio.",
    stars: 5,
  },
];

const stats = [
  { value: "10k+", label: "Clientes Gerenciados" },
  { value: "98%", label: "Uptime Garantido" },
  { value: "50k+", label: "Mensagens Enviadas" },
  { value: "4.9", label: "Avaliação Média" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const platform = usePlatformSettings();

  return (
    <div className={`min-h-screen bg-background text-foreground overflow-x-hidden ${platform.landing_dark_mode ? "dark" : ""}`}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {platform.logo_url ? (
              <img src={platform.logo_url} alt={platform.system_name} className="h-8 w-auto" />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
                  <BarChart3 className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold tracking-tight">{platform.system_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="shadow-lg shadow-primary/25">
              Criar Conta <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-3.5 w-3.5" />
              Plataforma completa de gestão
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Gerencie seus clientes com{" "}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                inteligência
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Automatize cobranças, envie notificações pelo WhatsApp e tenha controle total
              do seu negócio em uma única plataforma profissional.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto text-base px-8 shadow-xl shadow-primary/25">
                Começar Agora — Grátis <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="w-full sm:w-auto text-base px-8">
                Conhecer Recursos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points & WhatsApp Solution */}
      <section className="py-20 sm:py-28 border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-4 py-1.5 text-sm font-medium text-destructive">
              <Clock className="h-3.5 w-3.5" />
              O problema que você enfrenta
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Cobrar clientes manualmente é{" "}
              <span className="text-destructive">desgastante e ineficiente</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Você ainda perde horas do seu dia ligando, enviando e-mails ou anotando em planilhas quem pagou e quem não pagou?
            </p>
          </div>

          <div className="mx-auto max-w-5xl grid gap-8 lg:grid-cols-2 items-center">
            {/* Pain points */}
            <div className="space-y-6">
              <div className="flex gap-4 items-start rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">Cobranças manuais consomem seu tempo</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ligar para cada cliente, anotar quem pagou e quem está devendo gasta horas preciosas que você poderia investir no crescimento do seu negócio.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">E-mails não funcionam mais</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A taxa de abertura de e-mails de cobrança é inferior a 20%. Seus clientes simplesmente ignoram ou nem veem suas mensagens na caixa de entrada cheia de spam.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">Clientes caem no esquecimento</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sem um sistema organizado, clientes inadimplentes passam despercebidos e você perde receita mês após mês sem nem perceber.
                  </p>
                </div>
              </div>
            </div>

            {/* Solution */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <MessageSquare className="h-3.5 w-3.5" />
                A solução ideal
              </div>
              <h3 className="text-2xl font-bold mb-4">
                WhatsApp: onde seu cliente{" "}
                <span className="text-primary">realmente está</span>
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Com mais de <strong className="text-foreground">98% de taxa de leitura</strong>, o WhatsApp é o canal mais eficaz para se comunicar com seus clientes. Diferente do e-mail, suas mensagens são lidas em minutos — não em dias.
              </p>
              <ul className="space-y-3">
                {[
                  "Cobranças automáticas antes, no dia e após o vencimento",
                  "Mensagens personalizadas com nome, valor e data",
                  "Nenhum cliente fica esquecido no sistema",
                  "Reduza inadimplência em até 40% no primeiro mês",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-8 w-full shadow-lg shadow-primary/25" size="lg" onClick={() => navigate("/auth")}>
                Automatizar Minhas Cobranças <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-muted/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-extrabold text-primary sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que você precisa em{" "}
              <span className="text-primary">um só lugar</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Ferramentas poderosas para gerenciar, cobrar e se comunicar com seus clientes.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/50 bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simples de usar,{" "}
              <span className="text-primary">poderoso nos resultados</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">Comece em minutos com apenas 3 passos.</p>
          </div>
          <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
            {[
              { step: "01", title: "Crie sua conta", desc: "Cadastre-se gratuitamente e configure sua empresa em poucos minutos." },
              { step: "02", title: "Adicione clientes", desc: "Importe ou cadastre seus clientes com planos, datas e contatos." },
              { step: "03", title: "Automatize tudo", desc: "Configure cobranças automáticas e comece a faturar mais." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/25">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              O que nossos{" "}
              <span className="text-primary">clientes dizem</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Empresários que transformaram sua gestão com nossa plataforma.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-sm">
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-6 text-sm text-muted-foreground leading-relaxed italic">
                  "{t.content}"
                </p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-border/50 bg-primary/5">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 bottom-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para transformar sua gestão?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Junte-se a centenas de empresários que já automatizaram suas cobranças e aumentaram seus resultados.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto text-base px-8 shadow-xl shadow-primary/25">
              Criar Conta Grátis <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-500" />
            Sem cartão de crédito • Configuração em minutos
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              {platform.logo_url ? (
                <img src={platform.logo_url} alt={platform.system_name} className="h-6 w-auto opacity-70" />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">{platform.system_name}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {platform.system_name}. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
