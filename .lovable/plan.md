
# Plano: Módulo Fluxo de Caixa

## 1. Banco de dados (migration)

**Nova coluna em `admin_plans`:**
- `module_cashflow boolean NOT NULL DEFAULT false` — flag que libera o módulo por plano SaaS.

**Nova tabela `cash_flow_entries`:**
- `id`, `user_id`, `created_at`, `updated_at` (padrão)
- `type text NOT NULL` — `'income'` (provento) ou `'expense'` (gasto)
- `amount numeric NOT NULL`
- `description text NOT NULL`
- `category text` — texto livre (ex.: "Aluguel", "Marketing")
- `entry_date date NOT NULL DEFAULT CURRENT_DATE` — data da entrada/saída
- Trigger `update_updated_at_column`
- RLS: usuário só lê/insere/edita/deleta próprios registros (`auth.uid() = user_id`)
- Validação via trigger: `type IN ('income','expense')` e `amount > 0`

Faturas pagas **não** geram registro físico — serão somadas por agregação na leitura (sem duplicar).

## 2. Controle de acesso por plano

- Estender `PlanGuard` / contexto que já lê `admin_plans` para expor `module_cashflow`.
- Página `/cashflow` envolvida em guard: se plano do usuário não tem a flag, mostra tela de upgrade (mesmo padrão dos módulos atuais).
- Item no `AppSidebar` aparece somente quando o módulo está liberado.

## 3. Admin — edição do plano

- Em `AdminPlans.tsx`, adicionar switch **"Módulo Fluxo de Caixa"** junto aos demais módulos (campaigns, banners, games), salvando `module_cashflow`.

## 4. Nova página `/cashflow`

Estrutura:
- Header com título e botão **"Novo lançamento"**.
- Filtros: tipo (todos/proventos/gastos), período (mês atual / mês anterior / customizado), busca por descrição.
- Resumo do período: Total Proventos, Total Gastos, Saldo.
- Tabela paginada (20/pág.) com colunas: Data, Tipo (badge verde/vermelho), Descrição, Categoria, Valor, Ações (editar/excluir).
- Modal de cadastro/edição: tipo (provento/gasto), valor (BRL), data, descrição, categoria (input livre).
- Modais seguindo padrão responsivo do projeto (`w-[calc(100%-2rem)]`, `max-h-[85vh]`).

Rota registrada em `App.tsx` dentro de `<ProtectedPage>`.

## 5. Dashboard — novos cards

Ajuste em `src/pages/Dashboard.tsx`:

Cards financeiros existentes mantidos, com soma de proventos do `cash_flow_entries`:
- **Total Recebido (Geral)** = faturas pagas + payment_links pagos + legado + **proventos (todos)**
- **Recebido este Mês** = igual ao atual + **proventos do mês atual**
- **A Receber este Mês** — sem alteração

Novos cards:
- **Gastos este Mês** (vermelho) — soma de `expense` do mês atual
- **Gastos Total** (vermelho) — soma de `expense` desde sempre
- (Opcional, se couber visualmente) **Saldo Líquido do Mês** = Recebido mês − Gastos mês

Layout: grid de 3 colunas em `sm` vira 2 linhas (3+2 ou 3+3). Em mobile empilha.

Carregamento: nova query paralela `supabase.from('cash_flow_entries').select('type, amount, entry_date').eq('user_id', user.id)` no `fetchStats`, com agregação em memória.

## 6. Relatórios (escopo mínimo)

- Em `Reports.tsx`, adicionar aba/seção **Fluxo de Caixa** com export CSV de `cash_flow_entries` filtrado por período. (Mantém o padrão atual de relatórios.)

## 7. Memória

Salvar `mem://features/cashflow` documentando:
- Tabela `cash_flow_entries`, controle por flag `module_cashflow`, faturas pagas computadas por agregação (sem duplicar), cards do dashboard incluem proventos.

## Detalhes técnicos

- Supabase types: regenerados automaticamente após migration.
- Sem edge function — tudo client-side com RLS.
- Categoria livre (texto), sem CRUD próprio.
- BRL via `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Datas no fuso `America/Sao_Paulo` (helpers existentes em `src/lib/date-brt.ts`).
