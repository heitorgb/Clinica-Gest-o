# Arquitetura

## Objetivo

Criar uma plataforma propria para operacao administrativa, comercial e gerencial da clinica, reduzindo dependencia de multiplas ferramentas externas.

O sistema sera modular desde o inicio, mas sem overengineering. Cada modulo deve ter responsabilidades claras e evoluir conforme o MVP amadurece.

## Visao geral

```text
Frontend React
  |
  | HTTP/JSON
  v
Backend FastAPI
  |
  | SQLAlchemy
  v
PostgreSQL
```

## Separacao por camadas

### Frontend

Responsavel pela experiencia administrativa da equipe:

- Login
- Sessao web autenticada
- Navegacao do painel
- Formularios e listagens
- Dashboards
- Consumo da API

Estrutura inicial:

```text
frontend/src/
  app/
    Entrada da aplicacao React.

  components/
    Shell administrativo, cabecalhos, indicadores e elementos reutilizaveis.

  features/
    Telas por dominio do produto.

  lib/
    Configuracao de ambiente e cliente HTTP.

  routes/
    Mapa de rotas do painel.

  styles/
    Tailwind e estilos globais.
```

### Backend

Responsavel por regras de negocio, seguranca, validacao e persistencia:

- Autenticacao e autorizacao
- Usuarios e permissoes
- Regras de CRM
- Regras financeiras
- Regras de estoque
- Indicadores gerenciais
- Pontos futuros de integracao

### Banco de dados

Responsavel por armazenar dados transacionais e gerenciais:

- Usuarios
- Configuracoes da clinica
- Leads e funil
- Lancamentos financeiros
- Itens e movimentacoes de estoque
- Metas e comissoes futuras

Migrations sao versionadas com Alembic em `backend/alembic`. O backend usa a mesma variavel `DATABASE_URL` tanto na aplicacao quanto no Alembic.

## Organizacao do backend

```text
backend/app/
  core/
    Configuracoes globais, seguranca, constantes e utilitarios compartilhados.

  db/
    Conexao com banco, base declarativa, mixins reutilizaveis, sessao e suporte a migrations.

  modules/
    auth/
      Login, hash de senha, tokens JWT e usuario autenticado.

    users/
      Usuarios, papeis, permissoes e RBAC inicial.

    clinic/
      Dados e configuracoes administrativas da clinica.

    crm/
      Leads, origens, etapas do funil, responsavel comercial e resumo do pipeline.

    finance/
      Contas a pagar, contas a receber, categorias, vencimentos e resumo financeiro.

    inventory/
      Itens, movimentacoes, quantidade atual, minimo, custo e alertas.

    dashboard/
      Indicadores agregados, funil, financeiro, estoque critico e leitura executiva.

    performance/
      Metas por periodo, indicadores comerciais e controle inicial de comissoes.

    integrations/
      Status de provedores externos, previews de IA, chamada inicial ao Claude e
      base futura para WhatsApp.

    mcp/
      Endpoint remote MCP read-only para Claude consultar dashboard, CRM,
      financeiro e estoque.

    health/
      Verificacao tecnica da disponibilidade da API.
```

## Padrao interno dos modulos

Cada modulo podera conter, conforme necessidade:

```text
models.py       Modelos SQLAlchemy
schemas.py      Schemas Pydantic de entrada e saida
repository.py   Acesso a dados
service.py      Regras de negocio
router.py       Rotas HTTP do modulo
permissions.py  Regras de autorizacao especificas
```

Nem todo modulo precisa comecar com todos esses arquivos. A regra e criar apenas o necessario para manter o codigo simples.

## Organizacao do frontend

```text
frontend/src/
  app/
    Configuracao da aplicacao, providers e bootstrap.

  components/
    Componentes reutilizaveis de interface, como shell, cabecalhos, indicadores
    e controles responsivos de paginacao.

  features/
    Implementacoes por area do produto: auth, users, crm, finance, inventory, performance, settings e integrations.

    auth/
      Login web, sessao persistida no navegador, restauracao por token,
      protecao de rotas e helpers de permissao para o frontend.

    users/
      Consumo autenticado de usuarios, papeis e permissoes para administracao de acessos.

    clinic/
      Consumo autenticado e edicao das configuracoes administrativas da clinica.

    dashboard/
      Consumo autenticado do resumo gerencial, com estados de carregamento, erro e listas vazias.

    crm/
      Consumo autenticado do funil e da lista de leads, indicadores comerciais,
      filtros, paginacao, estados vazios e formularios de novo lead e edicao.

    finance/
      Consumo autenticado do resumo financeiro e lancamentos, com fluxo previsto,
      pendencias proximas, filtros, paginacao, validacao de periodo e formularios.

    inventory/
      Consumo autenticado do resumo de estoque, itens e movimentacoes, com
      alertas de compra, filtros, paginacao, estados vazios, criacao e edicao de item.

    performance/
      Consumo autenticado de metas, comissoes e resumo de performance, com
      filtros, paginacao, progresso por meta, validacao de periodo, criacao e edicao.

    settings/
      Preferencias do painel, incluindo tema claro/escuro persistido no navegador
      e atalhos para areas administrativas.

  lib/
    Cliente HTTP, montagem de query string, helpers de data e utilitarios compartilhados.

  routes/
    Definicao de rotas da aplicacao.

  styles/
    Tailwind e estilos globais.
```

## Decisoes tecnicas

- FastAPI foi escolhido pela produtividade, tipagem, documentacao automatica e boa integracao com Pydantic.
- PostgreSQL foi escolhido por robustez, confiabilidade e capacidade de evoluir para relatorios mais complexos.
- Alembic sera usado desde o inicio para manter o banco versionado.
- React com Tailwind permite construir um painel moderno sem depender de um framework pesado.
- JWT sera usado para suportar web e app mobile futuro.
- Senhas serao armazenadas somente como hash, nunca em texto puro.
- O primeiro administrador sera criado por seed idempotente no ambiente local.
- Docker Compose mantera o ambiente local previsivel.

## Diretrizes

- Preferir implementacoes simples e explicitas.
- Evitar abstrair antes da necessidade real.
- Separar dominios de negocio por modulo.
- Manter regras de negocio no backend.
- Manter credenciais fora do codigo.
- Criar migrations para toda mudanca estrutural do banco.
- Preparar integracoes futuras sem acoplar o MVP a elas.
