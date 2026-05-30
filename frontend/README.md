# Frontend

Painel web administrativo da clinica.

## Como rodar localmente

Depois de instalar as dependencias do frontend:

```bash
npm run dev
```

Use Node.js 20.19 ou superior para rodar localmente fora do Docker.

O painel ficara disponivel em:

```text
http://localhost:5173
```

## Estrutura

Areas iniciais:

- `auth`: telas e fluxo de login
- `users`: usuarios e permissoes
- `clinic`: configuracoes da clinica
- `crm`: leads e funil comercial
- `finance`: financeiro basico
- `inventory`: estoque basico
- `dashboard`: indicadores iniciais
