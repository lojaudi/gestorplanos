

## Plano de Alteracoes - Jogos do Dia

### 1. Filtro de Ligas na Edge Function

Reduzir a lista `BRAZIL_LEAGUES` para apenas 4 campeonatos e remover o fallback que exibe todos os jogos quando nao ha resultados.

**Ligas permitidas:**
- Brasileirao Serie A (71)
- Brasileirao Serie B (72)
- Copa do Brasil (73)
- Copa Libertadores (13)

**Comportamento:** Quando nao houver jogos nessas ligas, retornar lista vazia (sem fallback para outros campeonatos).

**Arquivo:** `supabase/functions/football-api/index.ts`

---

### 2. Melhoria do Layout dos Banners

Ajustar os 3 templates para:
- Logos dos times com tamanho proporcional e uniforme (usando `max-w` e `max-h` fixos em vez de classes absolutas como `h-8 w-8`)
- Logos dos canais de transmissao integradas na mesma linha do horario de cada jogo, com tamanho controlado
- Melhor espacamento e alinhamento geral

**Alteracoes por template:**

**ModernTemplate** (grade 2 colunas):
- Logos dos times: tamanho controlado com `w-10 h-10 max-w-[2.5em] max-h-[2.5em]`
- Logos dos canais: exibidas ao lado do horario, tamanho `h-3.5` com `max-h-[1em]`
- Remover area separada de canais e integrar na linha do horario

**SportyTemplate** (lista com barra lateral):
- Logos dos times: padronizar em `w-8 h-8`
- Logos dos canais: mover para dentro da area de horario/liga, tamanho `h-3.5`
- Melhor truncamento de nomes longos

**MinimalTemplate** (lista limpa):
- Logos dos times: padronizar em `w-7 h-7`
- Logos dos canais: integrar na linha do horario ao lado da hora
- Melhor espacamento vertical

**Arquivos:**
- `src/components/games/templates/ModernTemplate.tsx`
- `src/components/games/templates/SportyTemplate.tsx`
- `src/components/games/templates/MinimalTemplate.tsx`

---

### Detalhes Tecnicos

**Edge Function (`football-api/index.ts`):**
```
// Antes (11 ligas + fallback)
const BRAZIL_LEAGUES = [71, 73, 13, 11, 2, 3, 39, 140, 135, 78, 61];
const finalFixtures = filteredFixtures.length > 0 ? filteredFixtures : allFixtures;

// Depois (4 ligas, sem fallback)
const BRAZIL_LEAGUES = [71, 72, 73, 13];
const finalFixtures = filteredFixtures; // lista vazia se nao houver jogos
```

**Templates - Exemplo de mudanca nas logos (ModernTemplate):**
- Logos dos times passam de `h-8 w-8` para dimensoes proporcionais com `max-w` e `max-h`
- Canais saem de bloco separado abaixo e vao para a mesma linha do horario central
- Filtro CSS `brightness(0) invert(1)` mantido para templates escuros, removido para o MinimalTemplate (fundo claro)

