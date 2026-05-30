# Backend

API administrativa da plataforma.

## Como rodar localmente

Depois de instalar as dependencias do backend:

```bash
uvicorn app.main:app --reload
```

A documentacao interativa ficara disponivel em:

```text
http://localhost:8008/api/v1/docs
```

O health check fica em:

```text
http://localhost:8008/api/v1/health
```

## Banco de dados

Aplicar migrations:

```bash
alembic upgrade head
```

Criar uma nova migration a partir dos modelos:

```bash
alembic revision --autogenerate -m "descricao da mudanca"
```

## Autenticacao

Endpoints iniciais:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

## Usuarios e permissoes

Endpoints administrativos:

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/roles
GET    /api/v1/users/{user_id}
PATCH  /api/v1/users/{user_id}
```

O seed local cria o primeiro administrador a partir de:

```text
FIRST_SUPERUSER_NAME
FIRST_SUPERUSER_EMAIL
FIRST_SUPERUSER_PASSWORD
```

## Configuracoes da clinica

Endpoints protegidos por `clinic:manage`:

```text
GET   /api/v1/clinic/settings
PATCH /api/v1/clinic/settings
```

O modulo mantem os dados administrativos principais da clinica e cria um
registro padrao na primeira leitura, caso ainda nao exista configuracao.

## CRM e leads

Endpoints protegidos por `crm:manage`:

```text
GET   /api/v1/crm/pipeline
GET   /api/v1/crm/leads
POST  /api/v1/crm/leads
GET   /api/v1/crm/leads/{lead_id}
PATCH /api/v1/crm/leads/{lead_id}
```

O modulo inicial de CRM cobre cadastro de leads, origem, etapa do funil, status,
responsavel comercial, valor estimado e proximos contatos.

## Financeiro

Endpoints protegidos por `finance:manage`:

```text
GET   /api/v1/finance/summary
GET   /api/v1/finance/transactions
POST  /api/v1/finance/transactions
GET   /api/v1/finance/transactions/{transaction_id}
PATCH /api/v1/finance/transactions/{transaction_id}
```

O modulo inicial cobre lancamentos a pagar e receber, categoria, vencimento,
status, valor, pessoa ou empresa relacionada e resumo financeiro simples.

## Estoque

Endpoints protegidos por `inventory:manage`:

```text
GET   /api/v1/inventory/summary
GET   /api/v1/inventory/items
POST  /api/v1/inventory/items
GET   /api/v1/inventory/items/{item_id}
PATCH /api/v1/inventory/items/{item_id}
GET   /api/v1/inventory/movements
POST  /api/v1/inventory/movements
```

O modulo inicial cobre itens, quantidade atual, estoque minimo, custo,
fornecedor, entradas, saidas, ajustes e alertas de compra.

## Dashboard

Endpoint protegido por `dashboard:read`:

```text
GET /api/v1/dashboard/summary
```

O dashboard consolida funil comercial, resumo financeiro, proximos recebimentos
e alertas de estoque em uma leitura gerencial inicial.

## Metas, indicadores e comissoes

Endpoints protegidos por `performance:manage`:

```text
GET   /api/v1/performance/summary
GET   /api/v1/performance/goals
POST  /api/v1/performance/goals
GET   /api/v1/performance/goals/{goal_id}
PATCH /api/v1/performance/goals/{goal_id}
GET   /api/v1/performance/commissions
POST  /api/v1/performance/commissions
GET   /api/v1/performance/commissions/{commission_id}
PATCH /api/v1/performance/commissions/{commission_id}
```

O modulo inicial cobre metas por periodo, progresso, responsavel, comissoes,
status de aprovacao e resumo gerencial.

## Integracoes

Endpoints protegidos por `integrations:manage`:

```text
GET  /api/v1/integrations/status
POST /api/v1/integrations/ai/preview
POST /api/v1/integrations/ai/generate
POST /api/v1/integrations/whatsapp/preview
GET  /api/v1/integrations/mcp/settings
PATCH /api/v1/integrations/mcp/settings
```

O modulo inicial mostra o status de configuracao para OpenAI, WhatsApp e MCP,
alem de manter contratos para previews seguros de prompts e mensagens sem
executar envios externos pela interface.

As rotas de configuracao MCP exigem superadministrador. O token salvo nao e
retornado em texto puro pela API; a tela mostra apenas se existe token e uma
previa mascarada.

## MCP para Claude Pro

Endpoint remoto:

```text
POST /mcp
```

O servidor MCP inicia em modo seguro. Ele expoe ferramentas para consultar
dashboard, leads abertos, contas vencidas e estoque critico. As ferramentas de
leitura declaram `readOnlyHint=true` e `destructiveHint=false`.

Para permitir acoes administrativas, ative as ferramentas de escrita na tela de
Integracoes ou use `MCP_WRITE_TOOLS_ENABLED=true` como fallback inicial via
ambiente. Neste ciclo, as acoes liberadas sao:

```text
create_lead
update_lead_stage
create_receivable
create_payable
mark_financial_transaction_paid
create_inventory_item
register_inventory_movement
create_commission
update_commission_status
```

Elas aparecem para o Claude como ferramentas de acao, com `readOnlyHint=false`.

Auditoria administrativa:

```text
GET /api/v1/integrations/mcp/audit-logs
```

Cada chamada de ferramenta MCP registra ferramenta, argumentos, sucesso/erro,
duracao, origem e resumo do resultado. A auditoria pode ser ligada pela tela de
Integracoes ou por `MCP_AUDIT_ENABLED=true` como fallback de ambiente.

Autenticacao OAuth para Claude:

Configure pela tela de Integracoes como administrador do sistema. O `.env`
continua funcionando como fallback inicial:

```env
MCP_CONNECTOR_ENABLED=true
MCP_WRITE_TOOLS_ENABLED=true
MCP_AUDIT_ENABLED=true
MCP_AUTH_ENABLED=true
```

O Claude usa OAuth para conectores remotos. O cadastro deve usar a URL limpa
`https://seu-dominio/mcp`; o Claude abrira `/oauth/authorize`, onde um
administrador da clinica autoriza o acesso.

Para conectar no Claude Pro, o backend precisa estar publicado com HTTPS em uma
URL acessivel pela internet, por exemplo `https://seu-dominio/mcp`. Depois use
Customize > Connectors > Add custom connector no Claude.

## Modulos planejados

- `health`: verificacao tecnica da API
- `auth`: autenticacao, tokens e senha
- `users`: usuario base, papeis e permissoes futuras
- `clinic`: configuracoes da clinica
- `crm`: leads e funil comercial
- `finance`: contas e lancamentos financeiros
- `inventory`: produtos e movimentacoes de estoque
- `dashboard`: indicadores gerenciais
- `performance`: metas, indicadores e comissoes
- `integrations`: IA, WhatsApp e servicos externos futuros
- `mcp`: conector para Claude com leitura e acoes administrativas controladas
