## Objetivo

Adicionar na página **Clientes** exportação em **CSV** e **PDF**, permitindo baixar apenas os clientes marcados ou todos os clientes cadastrados.

## Alterações

### Seleção para exportação
- Reaproveitar as caixas de seleção já existentes em cada cliente.
- Manter o seletor do cabeçalho para marcar ou desmarcar os clientes visíveis na página atual.
- Adicionar uma ação clara de **Selecionar todos os clientes** quando houver filtros ou mais de uma página.
- Mostrar a quantidade escolhida antes da exportação.

### Botões e escolha do conteúdo
- Adicionar os botões **Exportar CSV** e **Exportar PDF** no topo da página.
- Ao clicar, abrir uma confirmação com duas opções:
  - **Clientes selecionados** — disponível quando houver pelo menos um marcado.
  - **Todos os clientes** — inclui todos os cadastrados, independentemente da página atual.
- Não alterar nem excluir dados durante a exportação.

### Dados incluídos
Cada arquivo terá:
- Nome do cliente
- Nome de usuário
- Telefone/WhatsApp
- Tipo de serviço
- Plano
- Valor do plano
- Data de cadastro
- Data de vencimento
- Status atual

### Formatos
- **CSV:** separado por ponto e vírgula, com acentuação compatível com Excel e valores/datas no padrão brasileiro.
- **PDF:** relatório pronto para imprimir ou salvar em PDF, com título, data de geração, total de clientes e tabela completa.
- Proteger os textos inseridos pelos usuários para que nomes e outros dados não quebrem o CSV ou o PDF.

## Validação
- Testar exportação de alguns clientes marcados e de todos os clientes.
- Confirmar que serviço, plano, telefone, datas, valores e status aparecem corretamente.
- Verificar o uso em tela grande e celular, inclusive quando nenhum cliente estiver selecionado.

## Fora do escopo
- Nenhuma alteração no cadastro dos clientes ou no banco de dados.
- Nenhum envio automático dos arquivos por WhatsApp ou e-mail.
