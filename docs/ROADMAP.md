# Roadmap

## Etapa 1: Estrutura base do projeto

Objetivo: criar o monorepo, documentacao inicial, estrutura de pastas e configuracao base.

Entregas:

- Estrutura `backend`, `frontend`, `infra` e `docs`
- Documentacao de arquitetura
- Roadmap inicial
- Exemplos de variaveis de ambiente
- Docker Compose inicial para PostgreSQL

## Etapa 2: Backend FastAPI

Objetivo: criar a API base.

Entregas:

- Aplicacao FastAPI
- Configuracao centralizada
- Health check
- Organizacao inicial de rotas
- Preparacao para conexao com banco
- Servico `api` no Docker Compose

## Etapa 3: Frontend React

Objetivo: criar a base visual do painel.

Entregas:

- Vite React com TypeScript
- Tailwind
- Layout administrativo inicial
- Rotas base
- Cliente HTTP
- Servico `web` no Docker Compose

## Etapa 4: PostgreSQL e migrations

Objetivo: conectar backend ao banco e versionar schema.

Entregas:

- SQLAlchemy
- Sessao de banco
- Alembic configurado
- Primeira migration
- Tabela inicial `clinic_settings`
- Backend aplicando migrations ao subir no Docker Compose

## Etapa 5: Autenticacao JWT

Objetivo: permitir login seguro.

Entregas:

- Hash de senha
- Login
- Access token
- Refresh token
- Protecao de rotas
- Tabela base de usuarios
- Endpoint de usuario autenticado

## Etapa 6: Usuarios e permissoes

Objetivo: controlar acesso por papel.

Entregas:

- Usuarios
- Papeis
- Permissoes basicas
- Usuario administrador inicial
- Endpoints administrativos protegidos
- Seed idempotente de papeis, permissoes e administrador local

## Etapa 7: CRM e leads

Objetivo: gerenciar oportunidades comerciais.

Entregas:

- Cadastro de leads
- Origem do lead
- Status
- Etapas do funil
- Responsavel comercial
- Valor estimado da oportunidade
- Proximo contato
- Resumo inicial do funil por etapa

## Etapa 8: Financeiro

Objetivo: controlar contas basicas.

Entregas:

- Contas a pagar
- Contas a receber
- Categorias
- Status de pagamento
- Filtros e resumo simples
- Data de vencimento
- Valor e pessoa/empresa relacionada
- Saldo previsto inicial

## Etapa 9: Estoque

Objetivo: controlar itens e movimentacoes.

Entregas:

- Itens de estoque
- Entradas
- Saidas
- Quantidade atual
- Alerta de estoque minimo
- Custo unitario
- Fornecedor
- Ajuste de contagem
- Valor total estimado em estoque

## Etapa 10: Dashboard gerencial

Objetivo: consolidar indicadores iniciais.

Entregas:

- Leads por etapa
- Receitas e despesas
- Contas em aberto
- Itens com estoque baixo
- Saldo previsto
- Proximos recebimentos
- Prioridades operacionais iniciais

## Etapa 11: Metas, indicadores e comissoes

Objetivo: apoiar gestao comercial e estrategica.

Entregas:

- Metas comerciais
- Indicadores por periodo
- Base para comissoes
- Relatorios iniciais
- Progresso por meta
- Responsavel por meta
- Status de comissoes
- Resumo inicial de performance

## Etapa 12: Integracoes futuras com IA e WhatsApp

Objetivo: preparar automacoes sem comprometer o MVP.

Entregas:

- Modulo de integracoes
- Status de configuracao para OpenAI, Claude e WhatsApp
- Estrutura para prompts e chamadas futuras de IA
- Preview seguro de prompt sem chamada externa
- Preview de mensagem de WhatsApp sem envio real
- Permissao dedicada para governanca de integracoes

## Ciclo 2: Frontend conectado a API

Objetivo: transformar as telas iniciais em fluxos reais, comecando pela
autenticacao.

Entregas iniciais:

- Login web conectado a `/api/v1/auth/login`
- Restauracao de sessao usando `/api/v1/auth/me`
- Renovacao automatica inicial usando `/api/v1/auth/refresh`
- Rotas internas protegidas por sessao
- Logout local no painel
- Identificacao do usuario autenticado no menu lateral
- Usuarios e permissoes conectados a `/api/v1/users` e `/api/v1/users/roles`
- Leitura administrativa de equipe, papeis e permissoes no frontend
- Configuracoes da clinica conectadas a `/api/v1/clinic/settings`
- Edicao dos dados administrativos da clinica pelo frontend
- Dashboard conectado a `/api/v1/dashboard/summary`
- Estados de carregamento, erro e listas vazias no dashboard
- CRM conectado a `/api/v1/crm/pipeline` e `/api/v1/crm/leads`
- Indicadores comerciais calculados a partir dos leads reais
- Financeiro conectado a `/api/v1/finance/summary` e `/api/v1/finance/transactions`
- Fluxo previsto e pendencias proximas calculados a partir dos lancamentos
- Estoque conectado a `/api/v1/inventory/summary`, `/api/v1/inventory/items` e `/api/v1/inventory/movements`
- Alertas de compra e movimentacoes recentes usando dados reais
- Metas e comissoes conectadas a `/api/v1/performance/summary`, `/api/v1/performance/goals` e `/api/v1/performance/commissions`
- Indicadores chave de performance calculados a partir de metas e comissoes reais

Proximas entregas:

- Criar formularios reais de cadastro e edicao nos demais modulos
- Tratar permissoes por modulo tambem no frontend

## Ciclo 3: Formularios reais do MVP

Objetivo: transformar as telas conectadas em fluxos operacionais de cadastro e
edicao.

Entregas iniciais:

- Formulario de novo lead conectado a `POST /api/v1/crm/leads`
- Formulario de edicao de lead conectado a `PATCH /api/v1/crm/leads/{lead_id}`
- Atualizacao automatica do funil e da lista apos salvar lead
- Formulario de novo lancamento conectado a `POST /api/v1/finance/transactions`
- Formulario de edicao de lancamento conectado a `PATCH /api/v1/finance/transactions/{transaction_id}`
- Atualizacao automatica do resumo financeiro apos salvar lancamento
- Formulario de novo item conectado a `POST /api/v1/inventory/items`
- Formulario de movimentacao conectado a `POST /api/v1/inventory/movements`
- Atualizacao automatica de indicadores, itens e movimentacoes apos salvar estoque
- Edicao de item conectada a `PATCH /api/v1/inventory/items/{item_id}`
- Formulario de nova meta conectado a `POST /api/v1/performance/goals`
- Formulario de nova comissao conectado a `POST /api/v1/performance/commissions`
- Atualizacao automatica dos indicadores de performance apos salvar
- Edicao de meta conectada a `PATCH /api/v1/performance/goals/{goal_id}`
- Edicao de comissao conectada a `PATCH /api/v1/performance/commissions/{commission_id}`
- Atualizacao automatica dos indicadores de performance apos editar
- Busca e filtros no CRM conectados a `GET /api/v1/crm/leads`
- Busca e filtros no financeiro conectados a `GET /api/v1/finance/transactions`
- Busca e filtros no estoque conectados a `GET /api/v1/inventory/items`
- Filtros de metas e comissoes conectados a `GET /api/v1/performance/goals` e `GET /api/v1/performance/commissions`
- Paginacao no CRM usando `skip` e `limit`
- Paginacao no financeiro usando `skip` e `limit`
- Paginacao no estoque usando `skip` e `limit`
- Paginacao em metas e comissoes usando `skip` e `limit`
- Estados vazios diferenciados para cadastro vazio, filtro sem resultado e pagina vazia
- Validacao de periodo nos filtros financeiros
- Validacao de periodo nos formularios de metas
- Paginacao com mensagem clara para paginas sem registros

Proximas entregas:

- Atalhos operacionais e confirmacoes de acoes sensiveis

## Ciclo 4: Revisao visual e responsiva

Objetivo: reduzir atritos de uso nas telas principais antes de adicionar novos
fluxos operacionais.

Entregas iniciais:

- Grupos de acoes dos cabecalhos preparados para quebra de linha em telas estreitas
- Botoes de limpar filtros com largura previsivel no mobile
- Paginacao preparada para evitar aperto de controles em telas menores
- Revisao de tabelas, filtros e cards mantendo a organizacao atual do MVP

Proximas entregas:

- Revisao visual em navegador quando a previa local estiver disponivel
- Atalhos operacionais e confirmacoes de acoes sensiveis

## Ciclo 5: Configuracoes e tema escuro

Objetivo: transformar o botao de configuracoes em uma area real do painel e
adicionar preferencia visual persistente.

Entregas iniciais:

- Rota `/configuracoes` criada para preferencias do painel
- Botao de engrenagem no topo conectado a tela de configuracoes
- Item de configuracoes adicionado ao menu lateral
- Tema claro/escuro com persistencia no navegador
- Atalho de tema no topo do painel
- Tela de configuracoes com atalhos para clinica, usuarios e integracoes

Proximas entregas:

- Conectar busca global do topo a dados reais
- Criar notificacoes iniciais ou remover temporariamente o botao de sino
- Atalhos operacionais e confirmacoes de acoes sensiveis

## Ciclo 6: Cadastro de usuarios

Objetivo: permitir que administradores criem acessos diretamente pelo painel.

Entregas iniciais:

- Botao de novo usuario na tela de usuarios
- Modal de cadastro conectado a `POST /api/v1/users`
- Campos de nome, e-mail, senha inicial, perfis, status ativo e administrador
- Botao e modal de criacao exibidos apenas para usuarios administradores
- Criacao ajustada para um unico tipo de usuario por acesso
- Backend rejeitando combinacoes indevidas de perfis operacionais
- Menu lateral e rotas protegidos por permissao no frontend
- Atualizacao automatica da lista e indicadores apos salvar
- Tratamento de sucesso e erro no fluxo de criacao

Proximas entregas:

- Edicao de usuarios existentes pelo frontend
- Reset/troca de senha por administrador
- Confirmacoes para acoes sensiveis de acesso

## Ciclo 7: Claude inicial

Objetivo: iniciar a integracao real com Claude mantendo seguranca operacional.

Entregas iniciais:

- Configuracoes `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` e `ANTHROPIC_API_VERSION`
- Endpoint `POST /api/v1/integrations/ai/generate`
- Cliente backend isolado para a Messages API da Anthropic
- Tratamento de chave ausente, erro remoto, resposta invalida e resposta sem texto
- Tela de integracoes conectada ao status real dos provedores
- Geracao com Claude pela tela de integracoes quando a chave estiver configurada
- Testes cobrindo chamada mockada e protecao contra chave ausente

Proximas entregas:

- Enviar contexto real do dashboard para o Claude
- Registrar historico e custos estimados de chamadas de IA
- Criar templates especificos para lead, financeiro e estoque

## Ciclo 8: Conector MCP para Claude Pro

Objetivo: permitir que o Claude consulte dados administrativos da clinica via
custom connector, sem depender de credito de API da Anthropic para esse fluxo.

Entregas iniciais:

- Endpoint remoto `POST /mcp`
- Inicializacao MCP com capacidade de tools
- Ferramentas read-only:
  - `get_dashboard_summary`
  - `list_open_leads`
  - `list_overdue_financial_items`
  - `list_low_stock_items`
- Anotacoes de seguranca `readOnlyHint=true` e `destructiveHint=false`
- Variaveis `MCP_CONNECTOR_ENABLED` e `MCP_SERVER_NAME`
- Flag `MCP_WRITE_TOOLS_ENABLED=false` para manter escrita desligada por padrao
- Tabela `mcp_audit_logs`
- Endpoint `GET /api/v1/integrations/mcp/audit-logs`
- Autenticacao por token no endpoint `/mcp`
- Suporte a `Authorization: Bearer`, `X-MCP-Token` e `?token=...`
- Ferramentas de escrita administrativas quando habilitadas:
  - `create_lead`
  - `update_lead_stage`
  - `create_receivable`
  - `create_payable`
  - `mark_financial_transaction_paid`
  - `create_inventory_item`
  - `register_inventory_movement`
  - `create_commission`
  - `update_commission_status`

Proximas entregas:

- Publicacao HTTPS para teste real no Claude Pro
- OAuth completo antes de ambientes multiusuario
- Regras finas de permissao por tipo de ferramenta
