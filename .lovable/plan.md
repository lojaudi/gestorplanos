

# 📋 SaaS de Gerenciamento de Cobranças via WhatsApp

## Visão Geral
Sistema SaaS multi-tenant para gerenciamento de clientes, serviços, planos recorrentes e envio automático de cobranças via WhatsApp usando a Evolution API 2.3.0+. Tema azul profissional, responsivo e instalável como PWA.

---

## Fase 1 – Fundação (Auth, Multi-Tenant, Dashboard)

### Autenticação e Controle de Acesso
- Login e registro com email/senha
- Dois perfis: **Admin Master** (dono da plataforma) e **Usuário** (cliente da plataforma)
- Isolamento de dados por tenant (cada usuário vê apenas seus dados)
- Admin Master pode criar, ativar/desativar contas e visualizar métricas gerais

### Dashboard Principal
- Cards informativos: Total de Clientes, Vencendo Hoje, Vencidos
- Gráfico de clientes ativos x vencidos
- Botões de navegação rápida para cada módulo
- Menu "Usuários" visível apenas para Admin Master

### Design
- Tema azul profissional com suporte a modo claro/escuro
- Layout mobile-first responsivo
- Sidebar com navegação principal

---

## Fase 2 – Cadastros (Clientes, Serviços, Planos)

### Módulo de Serviços
- CRUD simples com campo "Nome do Serviço"

### Módulo de Planos
- Planos: Mensal, Trimestral, Semestral, Anual
- Campos: Nome, Duração em meses, Valor (opcional)

### Módulo de Clientes
- Campos: Nome, Telefone/WhatsApp, Tipo de Serviço, Plano, Nome de Usuário (opcional)
- Cálculo automático da data de vencimento baseado no plano
- Status automático: Ativo / Vencendo Hoje / Vencido
- Tabela com filtros por status, período e dias específicos
- Seleção múltipla com checkbox para ações em massa

---

## Fase 3 – Templates de Mensagens

### Módulo de Templates
- Cadastro de templates separados por tipo: Vencendo Hoje, Vencido, Próximos 3 Dias
- Suporte a variáveis dinâmicas: `{nome}`, `{servico}`, `{plano}`, `{data_vencimento}`
- Preview da mensagem com variáveis substituídas

---

## Fase 4 – Integração WhatsApp (Evolution API)

### Configuração da Instância
- Formulário para cada usuário configurar: URL da API, API Key, Nome da instância
- Validação de conexão com a Evolution API
- Geração de QR Code (se aplicável)
- Exibição de status: Conectado / Desconectado

### Envio de Cobranças
- Envio individual ou em massa a partir da página de clientes
- Escolha do template por tipo
- Mensagem personalizada com variáveis preenchidas automaticamente
- Integração via Edge Function com o endpoint oficial da Evolution API

### Logs de Envio
- Histórico com: Cliente, Data/Hora, Tipo de Mensagem, Status (Sucesso/Erro), Retorno da API

---

## Fase 5 – Admin Master e PWA

### Painel Admin Master
- Listagem e gerenciamento de todos os usuários da plataforma
- Ativar/desativar contas
- Definir limites por conta
- Métricas gerais da plataforma

### PWA
- Manifest, service worker, ícone personalizado
- Instalável via navegador
- Cache básico offline

---

## Tecnologias
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) – Database, Auth, Edge Functions
- **API Externa:** Evolution API 2.3.0+ (via Edge Functions)
- **Gráficos:** Recharts

