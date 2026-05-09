# Validação de Variáveis de Ambiente com Zod — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralizar todas as variáveis de ambiente em `lib/env.ts` com validação Zod, garantindo que a aplicação não sobe se qualquer variável obrigatória estiver faltando.

**Architecture:** Um único módulo `lib/env.ts` define o schema Zod e exporta o objeto `env` tipado. O parse acontece no nível do módulo — se falhar, a aplicação para antes de aceitar requisições. O `next.config.ts` importa `lib/env.ts` para garantir o fail-fast ainda na inicialização do servidor Next.js.

**Tech Stack:** Zod (já instalado), Next.js 15 App Router, TypeScript estrito.

---

## Arquivos

| Ação          | Arquivo                                                 |
| ------------- | ------------------------------------------------------- |
| Criar         | `lib/env.ts`                                            |
| Criar         | `.env.example`                                          |
| Modificar     | `next.config.ts`                                        |
| Modificar     | `db/index.ts`                                           |
| Modificar     | `infra/database.ts`                                     |
| Modificar     | `app/api/v1/auth/login/route.ts`                        |
| Modificar     | `app/api/v1/status/route.ts`                            |
| Modificar     | `app/api/v1/users/route.ts`                             |
| Modificar     | `middleware.ts`                                         |
| Sem alteração | `drizzle.config.ts` — CLI tool com dotenv próprio       |
| Sem alteração | `infra/scripts/wait-for-postgres.js` — script Node puro |
| Sem alteração | `tests/orchestrator.js` — script Node puro              |

---

## Task 1: Criar `lib/env.ts`

**Files:**

- Create: `lib/env.ts`

- [ ] **Step 1: Criar o arquivo de validação**

```typescript
// lib/env.ts
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

- [ ] **Step 2: Verificar que o TypeScript aceita o arquivo**

```bash
npm run typecheck
```

Esperado: sem erros relacionados a `lib/env.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/env.ts
git commit -m "feat: cria lib/env.ts com validação Zod das variáveis de ambiente"
```

---

## Task 2: Criar `.env.example`

**Files:**

- Create: `.env.example`

- [ ] **Step 1: Criar o arquivo de exemplo**

```bash
# Conexão com o banco PostgreSQL
# Formato: postgres://usuario:senha@host:porta/banco
DATABASE_URL=postgres://usuario:senha@localhost:5432/biblitec

# Segredo para assinar os tokens JWT
# Deve ter no mínimo 32 caracteres. Gere com: openssl rand -base64 32
JWT_SECRET=troque_por_um_segredo_longo_e_aleatorio_aqui_minimo_32_chars

# Ambiente de execução (development | test | production)
NODE_ENV=development

# URL base da aplicação (usada para links absolutos)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Nome do banco de dados (exibido na rota /status)
POSTGRES_DB=biblitec

# Certificado SSL para conexão segura com o banco
# Necessário apenas em produção quando o banco exige SSL via CA customizada
# POSTGRES_CA=-----BEGIN CERTIFICATE-----
# ...conteúdo do certificado...
# -----END CERTIFICATE-----
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: adiciona .env.example com todas as variáveis documentadas"
```

---

## Task 3: Fail-fast no `next.config.ts`

**Files:**

- Modify: `next.config.ts`

O objetivo é garantir que a validação do `lib/env.ts` rode antes do servidor Next.js aceitar qualquer requisição. Importar no `next.config.ts` é o ponto mais cedo possível.

- [ ] **Step 1: Adicionar o import no next.config.ts**

Conteúdo atual:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Novo conteúdo:

```typescript
import type { NextConfig } from "next";
import "./lib/env";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore: importa lib/env no next.config.ts para fail-fast na inicialização"
```

---

## Task 4: Migrar `db/index.ts`

**Files:**

- Modify: `db/index.ts`

- [ ] **Step 1: Substituir process.env pelo objeto env**

Conteúdo atual:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function getSsl(): boolean | { ca: string } | undefined {
  if (process.env.POSTGRES_CA) return { ca: process.env.POSTGRES_CA };
  if (process.env.NODE_ENV === "production") return true;
  return undefined;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSsl(),
});

export const db = drizzle(pool, { schema });
```

Novo conteúdo:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "lib/env";
import * as schema from "./schema";

function getSsl(): boolean | { ca: string } | undefined {
  if (env.POSTGRES_CA) return { ca: env.POSTGRES_CA };
  if (env.NODE_ENV === "production") return true;
  return undefined;
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: getSsl(),
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add db/index.ts
git commit -m "refactor: migra db/index.ts para usar lib/env em vez de process.env"
```

---

## Task 5: Migrar `infra/database.ts`

**Files:**

- Modify: `infra/database.ts`

- [ ] **Step 1: Substituir process.env pelo objeto env**

Conteúdo atual:

```typescript
import { Client, type QueryConfig, type QueryResult } from "pg";

async function query(queryObject: QueryConfig): Promise<QueryResult> {
  let client: Client | undefined;
  try {
    client = await getNewClient();
    return await client.query(queryObject);
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    if (client) await client.end();
  }
}

async function getNewClient(): Promise<Client> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: getSslValues(),
  });
  await client.connect();
  return client;
}

function getSslValues(): boolean | { ca: string } {
  if (process.env.POSTGRES_CA) {
    return { ca: process.env.POSTGRES_CA };
  }
  return process.env.NODE_ENV === "production";
}

const database = { query, getNewClient };
export default database;
```

Novo conteúdo:

```typescript
import { Client, type QueryConfig, type QueryResult } from "pg";
import { env } from "lib/env";

async function query(queryObject: QueryConfig): Promise<QueryResult> {
  let client: Client | undefined;
  try {
    client = await getNewClient();
    return await client.query(queryObject);
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    if (client) await client.end();
  }
}

async function getNewClient(): Promise<Client> {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: getSslValues(),
  });
  await client.connect();
  return client;
}

function getSslValues(): boolean | { ca: string } {
  if (env.POSTGRES_CA) {
    return { ca: env.POSTGRES_CA };
  }
  return env.NODE_ENV === "production";
}

const database = { query, getNewClient };
export default database;
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add infra/database.ts
git commit -m "refactor: migra infra/database.ts para usar lib/env em vez de process.env"
```

---

## Task 6: Migrar as API routes

**Files:**

- Modify: `app/api/v1/auth/login/route.ts`
- Modify: `app/api/v1/status/route.ts`
- Modify: `app/api/v1/users/route.ts`

- [ ] **Step 1: Migrar `app/api/v1/auth/login/route.ts`**

Localizar as duas ocorrências de `process.env` e substituir:

```typescript
// linha com process.env.JWT_SECRET as string
process.env.JWT_SECRET as string;
// → substituir por:
env.JWT_SECRET;
```

```typescript
// linha com process.env.NODE_ENV
secure: process.env.NODE_ENV === "production",
// → substituir por:
secure: env.NODE_ENV === "production",
```

Adicionar o import no topo do arquivo (após os imports existentes):

```typescript
import { env } from "lib/env";
```

- [ ] **Step 2: Migrar `app/api/v1/status/route.ts`**

Adicionar o import no topo do arquivo:

```typescript
import { env } from "lib/env";
```

Substituir:

```typescript
const databaseName = process.env.POSTGRES_DB;
// → substituir por:
const databaseName = env.POSTGRES_DB;
```

- [ ] **Step 3: Migrar `app/api/v1/users/route.ts`**

Adicionar o import no topo do arquivo:

```typescript
import { env } from "lib/env";
```

Substituir:

```typescript
decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as {
// → substituir por:
decodedToken = jwt.verify(token, env.JWT_SECRET) as {
```

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros e sem nenhum `as string` restante nas rotas migradas.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/auth/login/route.ts app/api/v1/status/route.ts app/api/v1/users/route.ts
git commit -m "refactor: migra API routes para usar lib/env em vez de process.env"
```

---

## Task 7: Migrar `middleware.ts`

**Files:**

- Modify: `middleware.ts`

O middleware roda no Edge Runtime do Next.js. Zod é compatível com Edge Runtime (sem dependências de Node.js), então a importação de `lib/env.ts` funciona normalmente.

- [ ] **Step 1: Adicionar o import e substituir process.env**

Adicionar o import no topo do arquivo (após os imports existentes):

```typescript
import { env } from "lib/env";
```

Substituir:

```typescript
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
// → substituir por:
const secret = new TextEncoder().encode(env.JWT_SECRET);
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Verificar que não sobrou nenhum process.env nas rotas e middleware**

```bash
grep -rn "process\.env" app/ infra/database.ts db/index.ts middleware.ts
```

Esperado: nenhuma linha retornada. Se aparecer algo, corrigir antes de continuar.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "refactor: migra middleware.ts para usar lib/env em vez de process.env"
```

---

## Task 8: Verificação final e lint

**Files:** nenhum arquivo novo

- [ ] **Step 1: Rodar lint completo**

```bash
npm run lint:check
```

Esperado: zero erros ou warnings.

Se houver erros de formatação:

```bash
npm run lint:fix
git add -A
git commit -m "style: corrige formatação após migração para lib/env"
```

- [ ] **Step 2: Rodar typecheck completo**

```bash
npm run typecheck
```

Esperado: zero erros.

- [ ] **Step 3: Rodar a suite de testes**

```bash
npm test
```

Esperado: todos os testes passando. Os testes de integração já sobem o Next.js com as variáveis de ambiente corretas via `.env.development`, então o `lib/env.ts` será validado como parte do startup do servidor nos testes.

- [ ] **Step 4: Confirmar que o grep de process.env está limpo**

```bash
grep -rn "process\.env" app/ infra/database.ts db/index.ts middleware.ts next.config.ts lib/
```

Esperado: zero resultados. Qualquer resultado indica variável ainda não migrada.
