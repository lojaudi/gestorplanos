

# Sistema de Banners - Jogos do Dia

## Resumo

Criar um modulo completo para geracao de banners esportivos com os jogos do dia, seguindo os mesmos padroes arquiteturais do modulo de Filmes e Series ja existente. O sistema permitira que usuarios busquem partidas automaticamente via API de futebol, selecionem ate 6 jogos, personalizem banners com 3 modelos visuais distintos e enviem para clientes via WhatsApp.

---

## Fase 1 - Banco de Dados

Adicionar colunas na tabela `platform_settings` para as configuracoes globais do modulo:

- `football_api_key` (text) - Chave da API de futebol
- `football_api_provider` (text, default 'api-football') - Provedor de dados
- `football_timezone` (text, default 'America/Sao_Paulo') - Fuso horario
- `football_date_format` (text, default 'DD/MM HH:mm') - Formato de data/hora
- `football_default_font` (text, default 'Inter') - Fonte padrao
- `football_primary_color` (text, default '#1e3a5f') - Cor primaria dos banners
- `football_secondary_color` (text, default '#ffffff') - Cor secundaria
- `football_accent_color` (text, default '#f59e0b') - Cor destaque
- `football_default_logo_url` (text, nullable) - Logo padrao
- `football_banners_enabled` (boolean, default false) - Ativar/desativar modulo

Criar tabela `football_user_config` para configuracoes por usuario:

- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `logo_url` (text, nullable) - Logo do usuario
- `whatsapp_number` (text, nullable)
- `custom_title` (text, default 'Jogos de Hoje')
- `primary_color` (text, nullable) - Override de cor
- `secondary_color` (text, nullable)
- `accent_color` (text, nullable)
- `created_at`, `updated_at` (timestamps)

Politicas RLS para `football_user_config`:
- SELECT: `auth.uid() = user_id OR is_admin()`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`

---

## Fase 2 - Edge Function para API de Futebol

Criar nova edge function `football-api/index.ts` com as acoes:

1. **`get-matches`** - Busca partidas do dia no provedor configurado (API-Football via RapidAPI). Retorna lista de jogos com: times, logos, horario, competicao, canais de transmissao. Implementa cache simples (armazena resultado por 15 minutos).

2. **`get-leagues`** - Lista ligas/competicoes disponiveis para filtragem.

A funcao le a `football_api_key` da tabela `platform_settings` (mesmo padrao do TMDB).

---

## Fase 3 - Configuracoes Admin (AdminSettings.tsx)

Adicionar nova secao "Jogos do Dia - Configuracoes" na pagina de Configuracao Geral, abaixo da secao TMDB, contendo:

- Toggle ativar/desativar modulo
- Campo para API Key de futebol (tipo password com toggle de visibilidade)
- Dropdown de provedor (API-Football, Football-Data.org)
- Select de fuso horario
- Select de formato de data/hora
- Inputs de cores (primaria, secundaria, destaque) com color picker
- Select de fonte padrao
- Upload de logo padrao (fallback)

---

## Fase 4 - Pagina "Jogos do Dia" (GamesDay.tsx)

Nova pagina acessivel pelo menu lateral (substituir o item "Em Breve" atual).

### Secao de Configuracao do Usuario
- Upload de logo personalizada
- Campo de WhatsApp (aparece no banner)
- Campo de titulo customizado
- Override de cores (opcional)

### Secao de Selecao de Partidas
- Busca automatica dos jogos do dia ao abrir a pagina
- Filtro por liga/competicao
- Cards com: escudos dos times, nomes, horario, competicao
- Checkbox para selecionar ate 6 jogos
- Validacao de maximo 6 jogos

### Secao de Modelo de Banner
- 3 modelos visuais com thumbnail de preview:
  1. **Moderno** - Fundo gradiente escuro, cards em grid 2x3
  2. **Esportivo** - Fundo dinamico com textura, layout em lista com badges
  3. **Minimalista** - Fundo limpo, tipografia forte, separadores finos

### Preview e Geracao
- Preview em tempo real do banner com o modelo selecionado
- Botoes de formato: 1080x1080 (padrao) e 1080x1920 (stories)
- Geracao via html2canvas (mesmo padrao do modulo de filmes)
- Proxy de imagens via edge function existente (`image-proxy`)

### Botoes de Acao (mesmo padrao de Filmes/Series)
- "Enviar para Todos" - Envia para todos os clientes
- "Enviar para Ativos" - Envia apenas para clientes ativos
- Integracao com `evolution-api` e sistema de disparo em massa existente

---

## Fase 5 - Componentes

Criar os seguintes componentes em `src/components/games/`:

- `GamesDayConfigSection.tsx` - Config do usuario (logo, whatsapp, titulo)
- `MatchSelectionGrid.tsx` - Grid de selecao de partidas
- `BannerTemplateSelector.tsx` - Seletor visual dos 3 modelos
- `GameBannerPreview.tsx` - Preview + botoes de envio (reutiliza logica de envio do BannerPreview de filmes)
- `templates/ModernTemplate.tsx` - Layout moderno
- `templates/SportyTemplate.tsx` - Layout esportivo
- `templates/MinimalTemplate.tsx` - Layout minimalista

Cada template recebe as mesmas props (partidas, logo, cores, titulo, whatsapp) e renderiza de forma distinta.

---

## Fase 6 - Navegacao e Rotas

- Adicionar rota `/games-day` no `App.tsx`
- Atualizar `AppSidebar.tsx`: mudar item "Jogos do Dia" de `soon: true` para `path: "/games-day"`
- Registrar logs de geracao e envio na tabela `message_logs`

---

## Detalhes Tecnicos

### API de Futebol
O provedor principal sera API-Football (via RapidAPI). Endpoint principal:
```
GET /fixtures?date=YYYY-MM-DD&timezone=America/Sao_Paulo
```
Retorna: times com logos, horarios, liga, status. Canais de transmissao podem ser obtidos via endpoint separado ou configurados manualmente.

### Canais de Transmissao
Como APIs de futebol geralmente nao fornecem dados de transmissao, sera criado um mapeamento estatico com logos dos principais canais brasileiros (ESPN, Premiere, SporTV, Globo, etc.) e o usuario podera selecionar manualmente quais canais exibir por jogo.

### Exportacao
- PNG e JPG via html2canvas (mesmo padrao existente)
- Resolucoes: 1080x1080 e 1080x1920
- Upload para storage `platform-assets` antes do envio em massa

### Permissoes
- Apenas usuarios ativos (`profiles.is_active = true`) podem acessar
- Logs de geracao e envio registrados em `message_logs` com `template_type: 'game-banner'`

