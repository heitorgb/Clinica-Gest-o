# Infraestrutura

Configuracoes locais de infraestrutura do projeto.

O Docker Compose inclui:

- `web`: frontend React
- `api`: backend FastAPI
- `db`: banco PostgreSQL

O frontend usa `VITE_API_BASE_URL` para apontar para a API local.
