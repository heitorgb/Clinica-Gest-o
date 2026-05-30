# Alembic

Migrations do banco de dados PostgreSQL.

## Comandos principais

Criar uma migration:

```bash
alembic revision --autogenerate -m "descricao da mudanca"
```

Aplicar migrations:

```bash
alembic upgrade head
```

Reverter a ultima migration:

```bash
alembic downgrade -1
```
