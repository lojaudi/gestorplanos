
# Integração XUI.One (CRM → Servidor IPTV)

## Visão geral

Cada usuário do CRM cadastra **um ou mais servidores XUI.One** (host MySQL, porta, usuário, senha, database). Ao criar, renovar ou bloquear um cliente no CRM, o sistema executa a mesma ação na linha (`users`) do painel XUI.One via conexão MySQL direta a partir de uma Edge Function.

Não usaremos arquivo `.dbinfo` fisicamente — o conteúdo dele (host/porta/user/pass/db) é cadastrado em formulário. Quando você me enviar o `.dbinfo.json`, eu confirmo os nomes exatos das chaves; o XUI.One padrão usa `host`, `port` (default 7999), `username`, `password`, `database` (geralmente `xui`).

## Fluxo de uso

1. **Usuário** vai em *Configurações → Servidores IPTV* e cadastra:
   - Nome amigável (ex: "Servidor BR-01")
   - Host, Porta MySQL, Usuário, Senha, Database
   - Botão **Testar conexão** (faz `SELECT 1` e lista bouquets disponíveis)
2. Ao **criar/editar um cliente** no CRM aparece nova seção opcional **"Linha IPTV"**:
   - Servidor (select dos servidores cadastrados)
   - Username e senha da linha (ou "gerar automático")
   - Bouquets (multi-select carregado do servidor)
   - Max connections (default 1)
   - Checkbox "Sincronizar com servidor"
3. Ao salvar:
   - Se ainda não existe linha → cria `users` no XUI (insert) com `exp_date` baseado no `due_date`+meses do plano
   - Se já existe → atualiza `exp_date`, `bouquet`, `max_connections`, `enabled`
4. **Renovação** (pagamento confirmado / nova fatura paga): estende `exp_date` no XUI
5. **Bloqueio manual** ou inadimplência > X dias: seta `enabled=0` no XUI
6. **Exclusão** no CRM: opção "também excluir do servidor IPTV"
7. Toda operação é registrada em `iptv_sync_logs` (sucesso/erro/payload) e exibida na ficha do cliente

## O que NÃO está no escopo nesta primeira versão

- Não importa clientes do XUI para o CRM (só envia)
- Não gerencia revendedores/MAGs/Enigma/Resellers
- Não troca planos de bouquet em massa
- Não faz failover entre servidores

## Detalhes técnicos

### Banco (novas tabelas)

**`iptv_servers`** (por usuário)
- `user_id`, `name`, `host`, `port` (default 7999), `db_user`, `db_password` (criptografada via pgcrypto), `db_name` (default `xui`), `is_active`, `last_test_at`, `last_test_ok`
- RLS: owner-only

**`iptv_client_lines`** (vínculo cliente CRM ↔ linha no XUI)
- `user_id`, `client_id`, `server_id`, `xui_user_id` (id na tabela `users` do XUI), `xui_username`, `xui_password`, `bouquet_ids` (jsonb), `max_connections`, `enabled`, `exp_date`, `last_sync_at`, `last_sync_status`
- RLS: owner-only, unique(client_id, server_id)

**`iptv_sync_logs`**
- `user_id`, `client_id`, `server_id`, `action` (create/update/renew/block/unblock/delete/test), `status`, `error_message`, `payload` (jsonb)
- RLS: owner-only SELECT, insert via service role

### Edge function `iptv-xui-sync` (`verify_jwt = false`, valida JWT em código)

Ações:
- `test-connection` → conecta no MySQL, retorna versão + lista de bouquets (`SELECT id,bouquet_name FROM bouquets`)
- `list-bouquets` → retorna bouquets do servidor cadastrado
- `create-line` → insere em `users` do XUI: `username`, `password`, `member_id=0`, `admin_id` configurável, `bouquet=JSON`, `max_connections`, `exp_date=UNIX_TIMESTAMP`, `enabled=1`, `is_restreamer=0`, `created_at`
- `update-line` → update por `id` (exp_date, bouquet, max_connections, enabled, password)
- `renew-line` → mesma update mas só `exp_date`
- `set-enabled` → toggle `enabled` 0/1
- `delete-line` → delete por `id`

Driver MySQL: `https://deno.land/x/mysql/mod.ts` (deno-mysql). Conexão por request (sem pool persistente em edge function).

### Mapeamento de datas
- `exp_date` no XUI é UNIX timestamp em segundos (`UTC`). Calculado a partir de `clients.due_date` + horário 23:59:59 BRT convertido para UTC.

### Segurança
- Senha do MySQL **criptografada** em `iptv_servers.db_password` usando `pgcrypto` com chave em secret `IPTV_DB_ENCRYPTION_KEY` (vou adicionar via add_secret quando aprovar)
- Edge function descriptografa via RPC `decrypt_iptv_password(server_id)` (SECURITY DEFINER, retorna senha só para service role)
- Validação JWT do CRM em todas as ações antes de chamar o MySQL
- Validação Zod nos payloads de entrada

### Frontend
- Nova página `/settings/iptv-servers` com CRUD + botão "Testar"
- Seção "Linha IPTV" no dialog de criar/editar cliente (`Clients.tsx`)
- Aba "IPTV" na ficha do cliente mostrando última sincronização, status, botões "Renovar agora", "Bloquear", "Reenviar"
- Toast com resultado e link para o log

### Pontos de gatilho automático
- Ao salvar cliente (create/update) → chama `iptv-xui-sync` se houver linha vinculada
- Ao marcar fatura como **paga** (manual ou Mercado Pago webhook) → `renew-line` estendendo `exp_date` para nova `due_date`
- (Opcional, fase 2) Cron diário: bloqueia linhas de clientes vencidos > N dias

## O que preciso do arquivo `.dbinfo.json`

Só pra confirmar as chaves exatas e a versão do schema do seu painel. Se vier diferente do XUI padrão (ex: nome da coluna de bouquet, ou tabela de bouquets), eu ajusto os SQLs antes de implementar. **Pode enviar o arquivo** que eu valido em um teste local de SQL antes de seguir.

Se preferir enviar o ZIP do painel inteiro, eu olho também o módulo de criação de usuários pra garantir paridade total (campos opcionais como `is_trial`, `admin_enabled`, `is_restreamer`, etc.).

## Pergunta antes de começar a implementar

**Multi-servidor por cliente**: você quer permitir que um mesmo cliente do CRM tenha linhas em **mais de um servidor IPTV** ao mesmo tempo (failover/duplicação), ou **uma linha por cliente** é suficiente? Isso muda o schema de `iptv_client_lines` (unique apenas em `client_id` vs `client_id+server_id`).
