
# Integração WHMCS → Sistema atual (importar clientes)

## Visão geral

Criar um módulo que conecta ao WHMCS (versão 8.2) usando a **API REST oficial** e importa os **clientes** para o sistema atual. Configuração **global** (apenas admin define as credenciais), com **importação manual sob demanda** disparada por qualquer usuário do CRM, que vira o "dono" dos clientes importados na sua conta.

## Fluxo de uso

1. **Admin** vai em *Admin → Configurações → Integração WHMCS* e cadastra:
   - URL do WHMCS (ex: `https://meusite.com/whmcs`)
   - API Identifier
   - API Secret
   - Clica em "Testar conexão" → valida com chamada `WhmcsDetails`
2. **Usuário** (qualquer um) vai em *Clientes → Importar do WHMCS*
   - Vê lista paginada de clientes do WHMCS (nome, telefone, email, status)
   - Pode filtrar por status (Active, Closed, etc.) e buscar por nome
   - Seleciona quais importar (ou "selecionar todos da página") e clica em "Importar selecionados"
3. Sistema cria registros na tabela `clients` vinculados ao `user_id` do usuário logado
   - Telefone formatado com prefixo `55` se for BR e não tiver código país
   - Username = email do WHMCS (ou vazio)
   - Plano e data de vencimento ficam em branco (usuário ajusta depois ou via bulk edit)
4. **Deduplicação**: se já existir cliente com mesmo telefone para o mesmo `user_id`, pula e mostra no relatório de importação

## O que NÃO está no escopo

- Não sincroniza faturas, produtos ou pagamentos
- Não cria webhook (sem sincronização automática contínua) — é importação manual
- Não envia dados de volta ao WHMCS

## Detalhes técnicos

### Banco
Nova tabela `whmcs_global_config` (apenas 1 linha, somente admin pode ler/escrever):
- `api_url` (text)
- `api_identifier` (text)
- `api_secret` (text)
- `is_enabled` (boolean)
- timestamps

RLS: somente `is_admin()` para SELECT/INSERT/UPDATE/DELETE.

### Edge Function `whmcs-sync`
- `verify_jwt = false` (validação JWT em código + checagem de role)
- Ações:
  - `test-connection` → chama `WhmcsDetails` da API WHMCS, retorna versão
  - `list-clients` → chama `GetClients` (paginado, suporta `limitstart`, `limitnum`, `search`)
  - `import-clients` → recebe lista de IDs WHMCS, busca dados completos via `GetClientsDetails`, insere em `clients` com `user_id = auth.uid()` do chamador
- Autenticação WHMCS: usa `identifier` + `secret` no body (formato oficial da API WHMCS 8.x), `responsetype=json`
- Lê config de `whmcs_global_config` usando service role

### Frontend
- Nova página `/admin/whmcs` (config global, sidebar admin)
- Novo botão "Importar do WHMCS" em `/clients` abrindo modal com listagem + seleção
- Componentes shadcn existentes (Dialog, Table, Checkbox, Pagination)
- Toast de progresso e relatório final (importados / pulados / erros)

### Segurança
- Credenciais WHMCS ficam só no banco (não em secrets), mas em tabela protegida por RLS admin-only
- Edge function valida que o caller é autenticado antes de importar
- Sem exposição das credenciais ao cliente (frontend nunca vê o secret)

## Pergunta única antes de começar

Os clientes importados vão para a conta do **usuário que clicou em "Importar"**. Isso significa que se vários usuários do CRM importarem o mesmo cliente WHMCS, cada um terá uma cópia na sua própria base — isso é proposital (multi-tenant). Confirma essa lógica? Se preferir que o admin escolha "para qual usuário do CRM" importar cada lote, eu adiciono um seletor de destino no modal de importação.
