# Sistema de Gestao da Clinica

Plataforma interna para gestao administrativa, comercial e estrategica da clinica.

O projeto sera construido em etapas, com foco inicial em um MVP simples, bem organizado e pronto para crescer.

## Escopo do MVP

- Login e autenticacao
- Usuarios e permissoes
- Configuracoes da clinica
- CRM simples de leads
- Funil comercial
- Financeiro basico
- Estoque basico
- Dashboard inicial
- Estrutura preparada para integracoes futuras com IA

## Fora do escopo

Este sistema nao substitui o sistema clinico ja utilizado pela clinica.

Nao serao implementados neste projeto:

- Prontuario medico
- Agenda clinica
- Prescricao
- Evolucao medica
- Cadastro clinico complexo

## Stack planejada

- Backend: Python, FastAPI, SQLAlchemy, Alembic
- Banco de dados: PostgreSQL
- Frontend: React, TypeScript, Tailwind
- Autenticacao: JWT
- Infraestrutura: Docker e Docker Compose
- Configuracao: variaveis de ambiente via `.env`

## Estrutura inicial

```text
backend/
  app/
    core/
    db/
    modules/
  alembic/
  tests/

frontend/
  src/
    app/
    components/
    features/
    lib/
    routes/
    styles/

infra/
  docker/
  docker-compose.yml

docs/
  ARCHITECTURE.md
  ROADMAP.md
```

## Ordem de desenvolvimento

1. Estrutura base do projeto
2. Backend FastAPI
3. Frontend React
4. PostgreSQL e migrations
5. Autenticacao JWT
6. Usuarios e permissoes
7. CRM e leads
8. Financeiro
9. Estoque
10. Dashboard gerencial
11. Metas, indicadores e comissoes
12. Integracoes futuras com IA e WhatsApp

## Ambiente local

A infraestrutura local sobe PostgreSQL, API e frontend.

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
```

O arquivo `.env` e opcional no ambiente local, porque o Compose ja possui valores padrao de desenvolvimento. Use `.env` quando quiser trocar portas, usuario ou senha do banco.

As portas publicadas ficam no `.env`:

```env
FRONTEND_PORT=5180
BACKEND_PORT=8008
POSTGRES_PORT=5434
```

As portas internas dos containers ficam separadas:

```env
FRONTEND_CONTAINER_PORT=5180
BACKEND_CONTAINER_PORT=8000
```

Em Docker, a API deve falar com o banco usando `db:5432`. A porta `POSTGRES_PORT` serve apenas para acesso externo ao PostgreSQL pelo servidor; a porta interna do Postgres fica fixa em `5432`.

Depois disso:

```text
Web: http://localhost:5180
API: http://localhost:8008/api/v1/health
Docs: http://localhost:8008/api/v1/docs
```

O backend aplica as migrations do Alembic automaticamente ao subir no ambiente local com Docker Compose.

Endpoints iniciais de autenticacao:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

O frontend ja usa esses endpoints para login real, restauracao de sessao,
rotas protegidas e logout local. No MVP, os tokens JWT ficam no navegador para
manter o fluxo simples de desenvolvimento.

Endpoints administrativos de usuarios e permissoes:

```text
GET   /api/v1/users
POST  /api/v1/users
GET   /api/v1/users/roles
GET   /api/v1/users/{user_id}
PATCH /api/v1/users/{user_id}
```

A tela de usuarios web ja consome usuarios e papeis reais para exibir equipe,
perfis, status de acesso e permissoes disponiveis. Ela tambem permite criar
novos usuarios com senha inicial, perfis, status ativo e acesso de administrador,
mas essa acao aparece apenas para usuarios administradores. A criacao usa um
tipo unico de usuario, evitando combinar perfis operacionais como comercial e
estoque no mesmo acesso.

Endpoints de configuracoes da clinica:

```text
GET   /api/v1/clinic/settings
PATCH /api/v1/clinic/settings
```

A tela de clinica web ja consome e salva os dados administrativos reais da
clinica, incluindo nome, razao social, documento, contato, fuso horario e moeda.

Endpoints iniciais de CRM:

```text
GET   /api/v1/crm/pipeline
GET   /api/v1/crm/leads
POST  /api/v1/crm/leads
GET   /api/v1/crm/leads/{lead_id}
PATCH /api/v1/crm/leads/{lead_id}
```

O CRM web ja consome os endpoints de funil e listagem de leads para exibir
indicadores, oportunidades abertas por etapa e a tabela comercial inicial. A
tela tambem permite criar e editar leads usando os endpoints reais.
A listagem de leads tambem usa busca, etapa e status conectados a API.
A listagem tambem tem paginacao usando `skip` e `limit`.
Os estados vazios diferenciam ausencia de cadastro, filtros sem resultado e pagina sem registros.

Endpoints iniciais do financeiro:

```text
GET   /api/v1/finance/summary
GET   /api/v1/finance/transactions
POST  /api/v1/finance/transactions
GET   /api/v1/finance/transactions/{transaction_id}
PATCH /api/v1/finance/transactions/{transaction_id}
```

O financeiro web ja consome o resumo e a listagem de lancamentos para exibir
indicadores, fluxo previsto, pendencias proximas e a tabela financeira inicial.
A tela tambem permite criar e editar lancamentos usando os endpoints reais.
A listagem financeira tambem usa busca, tipo, status e periodo conectados a API.
A listagem tambem tem paginacao usando `skip` e `limit`.
Os filtros validam o periodo antes de buscar os lancamentos.

Endpoints iniciais de estoque:

```text
GET   /api/v1/inventory/summary
GET   /api/v1/inventory/items
POST  /api/v1/inventory/items
GET   /api/v1/inventory/items/{item_id}
PATCH /api/v1/inventory/items/{item_id}
GET   /api/v1/inventory/movements
POST  /api/v1/inventory/movements
```

O estoque web ja consome resumo, itens e movimentacoes para exibir indicadores,
alertas de compra, movimentacoes recentes e a tabela inicial de produtos e insumos.
A tela tambem permite criar e editar itens, alem de registrar movimentacoes de
estoque usando os endpoints reais.
A listagem de itens tambem usa busca, categoria e status conectados a API.
A listagem tambem tem paginacao usando `skip` e `limit`.
Os estados vazios diferenciam ausencia de cadastro, filtros sem resultado e pagina sem registros.

Endpoint inicial do dashboard:

```text
GET /api/v1/dashboard/summary
```

O dashboard web ja consome esse endpoint autenticado para exibir indicadores,
funil comercial, resumo financeiro, recebimentos proximos e alertas de estoque.

Endpoints iniciais de metas e comissoes:

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

A tela de metas web ja consome resumo, metas e comissoes para exibir progresso,
indicadores chave e controle inicial de comissoes.
A tela tambem permite criar e editar metas e comissoes usando os endpoints reais.
As listagens tambem usam filtros por status, indicador e responsavel.
As listas de metas e comissoes tambem tem paginacao usando `skip` e `limit`.
A criacao e edicao de metas validam o periodo antes de salvar.

A interface web tambem foi ajustada para melhor uso em telas estreitas, com
grupos de acoes que quebram linha, botoes de filtro previsiveis e paginacao
preparada para layouts menores.

A area de configuracoes do painel esta disponivel em `/configuracoes`. Ela
centraliza preferencias da interface, inclui alternancia de tema claro/escuro
e mantem atalhos para clinica, usuarios e integracoes.

Endpoints iniciais de integracoes:

```text
GET  /api/v1/integrations/status
POST /api/v1/integrations/ai/preview
POST /api/v1/integrations/ai/generate
POST /api/v1/integrations/whatsapp/preview
```

A integracao com Claude usa `ANTHROPIC_API_KEY` no backend, chama a Messages
API da Anthropic e mantem a chave fora do frontend. O primeiro fluxo real gera
conteudo administrativo para revisao humana antes de qualquer envio externo.

Conector MCP para Claude Pro:

```text
POST /mcp
GET  /mcp -> 405, sem stream SSE neste ciclo
```

O conector MCP expoe ferramentas read-only para dashboard, leads abertos,
financeiro vencido e estoque critico. Ferramentas de escrita podem ser
habilitadas com `MCP_WRITE_TOOLS_ENABLED=true`.

Ferramentas de acao liberadas quando a flag esta ativa:

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

Cada chamada de ferramenta MCP pode ser auditada em:

```text
GET /api/v1/integrations/mcp/audit-logs
```

O log registra ferramenta, argumentos, sucesso/erro, duracao, origem e resumo do
resultado. A auditoria e controlada por `MCP_AUDIT_ENABLED=true`.

O Ciclo 9 adiciona autenticacao por token ao endpoint MCP. Para habilitar:

```env
MCP_AUTH_ENABLED=true
MCP_AUTH_TOKEN=troque_por_um_token_longo
MCP_ALLOW_QUERY_TOKEN=true
```

O token pode ser enviado por `Authorization: Bearer`, `X-MCP-Token` ou, para
conectores que so aceitam URL, como `?token=...`. Para producao definitiva,
OAuth continua sendo o caminho recomendado.

Para usar no Claude Pro, publique o backend com HTTPS e cadastre a URL
`https://seu-dominio/mcp` em Customize > Connectors > Add custom connector. Em
desenvolvimento local, `localhost` nao basta para o Claude web, porque a chamada
vem da nuvem da Anthropic.

No ambiente local, o seed inicial cria um administrador se ele ainda nao existir:

```text
E-mail: admin@example.com
Senha: admin12345
```

Troque `FIRST_SUPERUSER_PASSWORD` no `.env` antes de usar fora do desenvolvimento local.
