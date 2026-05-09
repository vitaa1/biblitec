# Design: Validação de variáveis de ambiente com Zod

**Data:** 2026-05-09
**Issue:** configurar variáveis de ambiente com validação Zod

---

## Objetivo

Centralizar todas as variáveis de ambiente em `lib/env.ts` com validação Zod, garantindo que a aplicação não sobe se alguma variável obrigatória estiver faltando. Eliminar todos os `process.env.X as string` espalhados pelo código.

---

## Abordagem escolhida

Zod puro em `lib/env.ts`. Zod já está no projeto como dependência. O schema é parseado no nível do módulo — qualquer variável obrigatória ausente lança erro antes do servidor aceitar requisições.

Alternativas descartadas:

- `@t3-oss/env-nextjs` — adicionaria dependência sem benefício real no tamanho atual do projeto
- Validação manual — verbose, sem tipagem automática

---

## `lib/env.ts`

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_CA: z.string().optional(),
});

export const env = schema.parse(process.env);
```

---

## `.env.example`

Documenta todas as variáveis com comentários explicativos. `POSTGRES_CA` aparece comentada por ser opcional e exclusiva de produção.

---

## Fail fast

Importar `lib/env.ts` no `next.config.ts`. O Next.js processa esse arquivo antes de qualquer rota ou componente, garantindo que a validação rode antes do servidor aceitar requisições.

---

## Arquivos migrados

| Arquivo                          | Variáveis migradas                        |
| -------------------------------- | ----------------------------------------- |
| `app/api/v1/auth/login/route.ts` | `JWT_SECRET`                              |
| `app/api/v1/status/route.ts`     | `POSTGRES_DB`                             |
| `app/api/v1/users/route.ts`      | `JWT_SECRET`                              |
| `db/index.ts`                    | `DATABASE_URL`, `POSTGRES_CA`, `NODE_ENV` |
| `infra/database.ts`              | `DATABASE_URL`, `POSTGRES_CA`, `NODE_ENV` |
| `drizzle.config.ts`              | `DATABASE_URL`                            |
| `middleware.ts`                  | `JWT_SECRET`                              |
| `next.config.ts`                 | import de `lib/env.ts` (fail fast)        |

**Fora do escopo:** `infra/scripts/wait-for-postgres.js` e `tests/orchestrator.js` — scripts Node puros fora do contexto Next.js, tratam ausência de variáveis na própria lógica.

---

## Variáveis

| Variável              | Tipo            | Obrigatória                | Descrição                          |
| --------------------- | --------------- | -------------------------- | ---------------------------------- |
| `DATABASE_URL`        | string (URL)    | sim                        | Connection string do PostgreSQL    |
| `JWT_SECRET`          | string (min 32) | sim                        | Segredo para assinar tokens JWT    |
| `NODE_ENV`            | enum            | não (default: development) | Ambiente de execução               |
| `NEXT_PUBLIC_APP_URL` | string (URL)    | sim                        | URL base da aplicação              |
| `POSTGRES_DB`         | string          | sim                        | Nome do banco (exibido em /status) |
| `POSTGRES_CA`         | string          | não                        | Certificado SSL (somente produção) |
