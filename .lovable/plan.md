## Objetivo

Adicionar um seletor de moedas (BRL, USD, EUR) ao campo "Valor" do modal **Novo Lançamento** em `/cashflow`. Quando o usuário escolher USD ou EUR, o sistema converte automaticamente para Real usando a cotação do dia e salva o valor já convertido — mantendo o fluxo de caixa sempre em BRL como hoje.

## Alterações

### 1. `src/pages/CashFlow.tsx` — modal de lançamento
- Adicionar `currency` ao estado `form` (default: `"BRL"`).
- Junto ao input de valor, colocar um pequeno `<select>` nativo (BRL / USD / EUR) — mesmo padrão dos outros selects da página, evitando scroll-lock.
- Ao salvar:
  - Se `currency === "BRL"` → comportamento atual.
  - Se `USD` ou `EUR` → buscar cotação do dia, calcular `amount_brl = valor * cotação`, e salvar em `cash_flow_entries.amount` esse valor já convertido.
  - Anexar à `description` um sufixo automático: `" (USD 50,00 @ R$ 5,12)"` para o usuário saber a origem.
- Mostrar uma linha pequena abaixo do campo com a prévia: *"≈ R$ 256,00 (cotação de hoje: 5,12)"* assim que o usuário digitar.
- Mensagens de erro/toast amigáveis se a cotação falhar (com opção de digitar manualmente em BRL).

### 2. Cotação do dia
- Usar a API pública **AwesomeAPI** (`https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL`) — gratuita, sem chave, com CORS liberado, ideal para uso direto no frontend.
- Buscar a cotação uma vez quando o modal abre (e cachear por sessão durante 10 min para evitar requests repetidos).
- Campo de bid (compra) será usado como referência.

### 3. Comportamento dos dados existentes
- Nada muda no banco. Continua tudo em BRL na coluna `amount`.
- Lançamentos antigos permanecem inalterados.
- Faturas e links de pagamento (que já vêm em BRL) seguem como estão.

## Pontos técnicos

- Sem novas tabelas, sem migration, sem edge function — conversão acontece no cliente no momento do save.
- A taxa é "congelada" no momento do lançamento (padrão contábil correto): se você lançar US$ 100 hoje a 5,12, o valor em reais não muda amanhã quando a cotação variar.
- Edição de um lançamento existente abrirá com BRL selecionado (já está convertido); se o usuário quiser re-converter, basta trocar a moeda novamente.

## Fora do escopo

- Não vou adicionar histórico de cotações nem coluna `original_currency`/`original_amount` no banco (poderia ser feito depois se você quiser auditoria — me avise).
- Não vou alterar gráficos, relatórios ou exports — todos continuam em BRL.