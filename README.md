# Connect & Collect

Crie uma aplicação web no modelo SaaS (Software as a Service) para gerenciamento de clientes, serviços, planos recorrentes e envio automático de cobranças via WhatsApp utilizando obrigatoriamente a API Evolution 2.3.0 ou superior.

A aplicação deve ser moderna, responsiva, estilo SaaS profissional, com arquitetura escalável e preparada para múltiplos usuários (multi-tenant).

ARQUITETURA DO SISTEMA

Frontend moderno e responsivo

Backend estruturado em API REST

Banco de dados relacional (PostgreSQL)

Autenticação segura (JWT)

Sistema Multi-Tenant (cada usuário possui seus próprios dados isolados)

PWA (instalável como aplicativo)

Integração exclusiva com API Evolution 2.3.0+

Logs de envio de mensagens

Controle de permissões (Admin Master e Usuários)

MODELO SaaS

Admin Master (Dono da Plataforma)

Pode:

Criar usuários

Ativar/desativar contas

Definir limites

Visualizar métricas gerais

Usuário Cliente da Plataforma

Pode:

Cadastrar clientes

Cadastrar serviços

Cadastrar planos

Configurar WhatsApp via Evolution API

Criar templates de mensagens

Enviar cobranças

Cada usuário deve ter:

Seus próprios clientes

Seus próprios serviços

Seus próprios planos

Seus próprios templates

Sua própria instância Evolution

MÓDULO 1 – CADASTRO DE CLIENTES

Campos obrigatórios:

Nome do Cliente

Telefone/WhatsApp

Tipo de Serviço

Plano Contratado

Data de Cadastro

Campo opcional:

Nome de Usuário

Regras automáticas:

O sistema deve calcular automaticamente a data de vencimento com base no plano:

Mensal → +1 mês

Trimestral → +3 meses

Semestral → +6 meses

Anual → +12 meses

Status automático:

Ativo

Vencendo hoje

Vencido

MÓDULO 2 – CADASTRO DE SERVIÇOS

Campo único:

Nome do Serviço (obrigatório)

MÓDULO 3 – CADASTRO DE PLANOS

Planos padrão:

Mensal

Trimestral

Semestral

Anual

Cada plano deve conter:

Nome

Duração em meses

Valor (opcional)

DASHBOARD PRINCIPAL

Deve conter:

Botões:

Clientes

Serviços

Planos

Templates

Configuração WhatsApp

Usuários (apenas Admin Master)

Cards Informativos:

Total de Clientes

Clientes vencendo hoje

Clientes vencidos

❌ Não é necessário notificação push para clientes a vencer.

PÁGINA DE CLIENTES

Tabela com:

Nome

Telefone

Serviço

Plano

Data de vencimento

Status

Seleção múltipla (checkbox)

Filtros:

Status

Período

Dias específicos

Botão principal:

📩 Enviar Cobrança via WhatsApp

Funcionalidades:

Envio individual ou em massa

Escolher tipo de template

Registrar log de envio

Exibir sucesso ou erro retornado pela Evolution API

MÓDULO DE TEMPLATES

Criar página para cadastrar templates separados por tipo:

Vencendo hoje

Cliente vencido

Próximos 3 dias

Permitir variáveis dinâmicas:

{nome}

{servico}

{plano}

{data_vencimento}

INTEGRAÇÃO WHATSAPP – EVOLUTION API 2.3.0+

Obrigatório utilizar Evolution API 2.3.0 ou superior.

Cada usuário deve:

Criar/configurar sua instância Evolution

Informar:

URL da API

API Key

Nome da instância

Sistema deve:

Validar conexão

Permitir gerar QR Code (se aplicável)

Confirmar conexão

Exibir status: Conectado / Desconectado

Envio de mensagens deve:

Utilizar endpoint oficial da Evolution

Enviar mensagem personalizada com variáveis

Registrar resposta da API

Armazenar logs (sucesso/erro)

LOGS DE ENVIO

Criar tabela de histórico contendo:

Cliente

Data e hora

Tipo de mensagem

Status (Sucesso/Erro)

Retorno da API

PWA

O sistema deve:

Ter manifest.json

Ter service worker

Permitir instalação via navegador

Ícone personalizado

Cache básico offline

🔐 SEGURANÇA

Senhas criptografadas (bcrypt)

Middleware de autenticação

Isolamento de dados por tenant

Validação de dados no backend

Controle de acesso por perfil

🎨 INTERFACE

Estilo SaaS moderno:

Layout limpo

Cards informativos

Dashboard intuitivo

Tema claro e escuro

Responsivo (mobile-first)

📈 DIFERENCIAIS

Gráfico de clientes ativos x vencidos

Filtros inteligentes

Sistema preparado para escalar

Estrutura modular

Código organizado por camadas

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gestorplanos.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb33ec7a-5ada-4f1d-b0c9-235eb8bf7cc4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
