# Infraestrutura

Configuracoes locais de infraestrutura do projeto.

O Docker Compose inclui:

- `web`: frontend React
- `api`: backend FastAPI
- `db`: banco PostgreSQL

O frontend usa `VITE_API_BASE_URL` para apontar para a API local.

## Portas

As portas publicadas pelo Docker Compose devem ser configuradas no `.env` da raiz:

- `FRONTEND_PORT`: porta externa do React.
- `BACKEND_PORT`: porta externa da API.
- `POSTGRES_PORT`: porta externa do PostgreSQL.

As portas internas mantem os containers conversando entre si:

- `FRONTEND_CONTAINER_PORT=5180`
- `BACKEND_CONTAINER_PORT=8000`

Em producao, normalmente voce altera apenas as portas externas. O backend deve acessar o banco
por `db:5432` dentro da rede Docker, mesmo que o PostgreSQL esteja publicado no servidor como
`5434`. A porta interna do Postgres fica fixa em `5432`.
