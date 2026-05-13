# Gestão de Exemplares por Giroteca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar seção de exemplares à página `/livros/[id]`, com listagem, adição e baixa de exemplares, respeitando isolamento por giroteca.

**Architecture:** O backend expõe três novas rotas de API (`GET+POST /api/v1/livros/[id]/exemplares`, `GET /api/v1/exemplares/proximo-codigo`, `PATCH /api/v1/exemplares/[id]/baixar`) consumidas por componentes Client do App Router; o Server Component `ExemplaresSection` faz fetch direto ao model e renderiza a lista, delimitando o que é SSR do que é interativo. Dialogs (adicionar / baixar) são Client Components que chamam a API e disparam `router.refresh()` após mutações.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Zod, React 19, shadcn/ui (Dialog, Select, Input, Textarea), Tailwind CSS v4, Jest + fetch nativo.

---

## Mapa de arquivos

| Ação      | Arquivo                                                           |
| --------- | ----------------------------------------------------------------- |
| Modificar | `models/exemplares.ts`                                            |
| Modificar | `infra/schemas.ts`                                                |
| Modificar | `tests/factories/index.ts`                                        |
| Modificar | `tests/integration/models/exemplares.test.ts`                     |
| Modificar | `app/(app)/livros/[id]/page.tsx`                                  |
| Criar     | `app/api/v1/livros/[id]/exemplares/route.ts`                      |
| Criar     | `app/api/v1/exemplares/proximo-codigo/route.ts`                   |
| Criar     | `app/api/v1/exemplares/[id]/baixar/route.ts`                      |
| Criar     | `app/(app)/livros/[id]/_components/exemplares-section.tsx`        |
| Criar     | `app/(app)/livros/[id]/_components/adicionar-exemplar-dialog.tsx` |
| Criar     | `app/(app)/livros/[id]/_components/baixar-exemplar-dialog.tsx`    |
| Criar     | `tests/integration/api/v1/livros/exemplares/get.test.ts`          |
| Criar     | `tests/integration/api/v1/livros/exemplares/post.test.ts`         |
| Criar     | `tests/integration/api/v1/exemplares/proximo-codigo.test.ts`      |
| Criar     | `tests/integration/api/v1/exemplares/baixar.test.ts`              |

---

## Task 1: Model — `listarPorLivroNaGiroteca`

**Files:**

- Modify: `models/exemplares.ts`
- Test: `tests/integration/models/exemplares.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/integration/models/exemplares.test.ts`:

```typescript
import {
  buscarPorTombamento,
  criarParaGiroteca,
  listarPorLivroNaGiroteca,
  mudarStatus,
} from "models/exemplares";
```

E os novos testes (adicionar após os existentes):

```typescript
test("listarPorLivroNaGiroteca() gestor vê apenas exemplares da própria giroteca", async () => {
  const livro = await criarLivro();
  const girotecaB = await criarGiroteca({
    codigo: "B002",
    nome: "Giroteca B2",
  });
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "A-001" });
  await criarExemplar(livro.id, girotecaB.id, { codigoTombamento: "B-001" });

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxGestorA);

  expect(lista).toHaveLength(1);
  expect(lista[0].codigoTombamento).toBe("A-001");
});

test("listarPorLivroNaGiroteca() exemplar disponível tem nomeLeitor null", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "A-002" });

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxGestorA);

  expect(lista[0].nomeLeitor).toBeNull();
});

test("listarPorLivroNaGiroteca() exemplar emprestado expõe nome do leitor", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A-003",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaA.id, { nome: "Maria das Flores" });
  const gestor = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  await criarEmprestimo(exemplar.id, leitor.id, gestor.id);

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxGestorA);

  expect(lista[0].nomeLeitor).toBe("Maria das Flores");
});

test("listarPorLivroNaGiroteca() admin_nthe vê todas as girotecas", async () => {
  const livro = await criarLivro();
  const girotecaB = await criarGiroteca({
    codigo: "B003",
    nome: "Giroteca B3",
  });
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "A-004" });
  await criarExemplar(livro.id, girotecaB.id, { codigoTombamento: "B-004" });
  const adminUser = await criarUsuario({
    papel: "admin_nthe",
    girotecaId: null,
  });
  const ctxAdmin = {
    usuarioId: adminUser.id,
    papel: "admin_nthe" as const,
    girotecaId: null,
  };

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxAdmin);

  expect(lista).toHaveLength(2);
});
```

- [ ] **Step 2: Adicionar `criarEmprestimo` às factories**

Em `tests/factories/index.ts`, adicionar após `criarLeitor`:

```typescript
export async function criarEmprestimo(
  exemplarId: string,
  leitorId: string,
  registradoPorId: string,
  override: Partial<typeof emprestimos.$inferInsert> = {},
) {
  const [row] = await db
    .insert(emprestimos)
    .values({
      exemplarId,
      leitorId,
      registradoPorId,
      dataPrevistaDevolucao: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      ...override,
    })
    .returning();
  return row;
}
```

Atualizar o import no topo de `tests/integration/models/exemplares.test.ts`:

```typescript
import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";
```

- [ ] **Step 3: Rodar testes para confirmar falha**

```bash
npm test -- --testPathPattern="models/exemplares" 2>&1 | tail -30
```

Esperado: `listarPorLivroNaGiroteca is not a function` (ou similar).

- [ ] **Step 4: Implementar `listarPorLivroNaGiroteca` em `models/exemplares.ts`**

Substituir os imports no topo:

```typescript
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";
```

Adicionar o novo tipo e função após a linha `export type Exemplar = ...`:

```typescript
export type ExemplarComLeitor = Exemplar & { nomeLeitor: string | null };

export async function listarPorLivroNaGiroteca(
  livroId: string,
  contexto: Contexto,
): Promise<ExemplarComLeitor[]> {
  const rows = await db
    .select({
      id: exemplares.id,
      livroId: exemplares.livroId,
      girotecaId: exemplares.girotecaId,
      codigoTombamento: exemplares.codigoTombamento,
      estado: exemplares.estado,
      status: exemplares.status,
      observacoes: exemplares.observacoes,
      criadoEm: exemplares.criadoEm,
      atualizadoEm: exemplares.atualizadoEm,
      nomeLeitor: leitores.nome,
    })
    .from(exemplares)
    .leftJoin(
      emprestimos,
      and(
        eq(emprestimos.exemplarId, exemplares.id),
        isNull(emprestimos.dataDevolucao),
      ),
    )
    .leftJoin(leitores, eq(leitores.id, emprestimos.leitorId))
    .where(
      and(
        eq(exemplares.livroId, livroId),
        contexto.papel === "gestor_giroteca"
          ? eq(exemplares.girotecaId, contexto.girotecaId!)
          : undefined,
      ),
    )
    .orderBy(exemplares.codigoTombamento);

  return rows.map((r) => ({ ...r, nomeLeitor: r.nomeLeitor ?? null }));
}
```

- [ ] **Step 5: Rodar testes para confirmar que passam**

```bash
npm test -- --testPathPattern="models/exemplares" 2>&1 | tail -30
```

Esperado: todos os testes de `exemplares.test.ts` passando.

- [ ] **Step 6: Commit**

```bash
git add models/exemplares.ts tests/factories/index.ts tests/integration/models/exemplares.test.ts
git commit -m "feat: adiciona listarPorLivroNaGiroteca com nome do leitor ativo"
```

---

## Task 2: Model — `sugerirProximoCodigo`

**Files:**

- Modify: `models/exemplares.ts`
- Test: `tests/integration/models/exemplares.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/integration/models/exemplares.test.ts`:

```typescript
import { sugerirProximoCodigo } from "models/exemplares";
```

> Atualizar o import já existente de `models/exemplares` para incluir `sugerirProximoCodigo`.

Novos testes:

```typescript
test("sugerirProximoCodigo() retorna '1' quando não há exemplares", async () => {
  const proximo = await sugerirProximoCodigo(girotecaA.id, ctxGestorA);
  expect(proximo).toBe("1");
});

test("sugerirProximoCodigo() incrementa o maior código numérico", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "3" });
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "7" });

  const proximo = await sugerirProximoCodigo(girotecaA.id, ctxGestorA);

  expect(proximo).toBe("8");
});

test("sugerirProximoCodigo() ignora códigos não numéricos", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "ABC-001" });

  const proximo = await sugerirProximoCodigo(girotecaA.id, ctxGestorA);

  expect(proximo).toBe("1");
});

test("sugerirProximoCodigo() gestor não pode sugerir para outra giroteca", async () => {
  await expect(
    sugerirProximoCodigo(girotecaB.id, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test -- --testPathPattern="models/exemplares" 2>&1 | tail -20
```

Esperado: `sugerirProximoCodigo is not a function`.

- [ ] **Step 3: Implementar `sugerirProximoCodigo` em `models/exemplares.ts`**

Adicionar após `listarPorLivroNaGiroteca`:

```typescript
export async function sugerirProximoCodigo(
  girotecaId: string,
  contexto: Contexto,
): Promise<string> {
  if (
    contexto.papel === "gestor_giroteca" &&
    girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .select({
      proximo:
        sql<number>`COALESCE(MAX(CASE WHEN ${exemplares.codigoTombamento} ~ '^[0-9]+$' THEN CAST(${exemplares.codigoTombamento} AS INTEGER) ELSE NULL END), 0) + 1`.mapWith(
          Number,
        ),
    })
    .from(exemplares)
    .where(eq(exemplares.girotecaId, girotecaId));

  return String(row?.proximo ?? 1);
}
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npm test -- --testPathPattern="models/exemplares" 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add models/exemplares.ts tests/integration/models/exemplares.test.ts
git commit -m "feat: adiciona sugerirProximoCodigo para exemplares da giroteca"
```

---

## Task 3: Model — `mudarStatus` com nome do leitor no erro

**Files:**

- Modify: `models/exemplares.ts`
- Test: `tests/integration/models/exemplares.test.ts`

- [ ] **Step 1: Atualizar o teste existente de baixa com empréstimo em aberto**

Em `tests/integration/models/exemplares.test.ts`, substituir o teste `"mudarStatus() não pode baixar exemplar emprestado"`:

```typescript
test("mudarStatus() não pode baixar exemplar emprestado — inclui nome do leitor", async () => {
  const livro = await criarLivro();
  const leitor = await criarLeitor(girotecaA.id, { nome: "João Antônio" });
  const gestorUser = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-011",
    status: "emprestado",
  });
  await criarEmprestimo(exemplar.id, leitor.id, gestorUser.id);

  await expect(
    mudarStatus(exemplar.id, "baixado", "Perdido", ctxGestorA),
  ).rejects.toMatchObject({
    status_code: 409,
    message: expect.stringContaining("João Antônio"),
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test -- --testPathPattern="models/exemplares" 2>&1 | tail -20
```

Esperado: o teste falha com `message` não contendo "João Antônio".

- [ ] **Step 3: Atualizar `mudarStatus` em `models/exemplares.ts`**

Substituir o bloco `if (status === "baixado" && exemplar.status === "emprestado")` dentro de `mudarStatus`:

```typescript
if (status === "baixado" && exemplar.status === "emprestado") {
  const [emprestimoAberto] = await db
    .select({ nomeLeitor: leitores.nome })
    .from(emprestimos)
    .innerJoin(leitores, eq(leitores.id, emprestimos.leitorId))
    .where(
      and(eq(emprestimos.exemplarId, id), isNull(emprestimos.dataDevolucao)),
    );
  const nome = emprestimoAberto?.nomeLeitor ?? "um leitor";
  throw new AppError(
    `Este exemplar está com ${nome}. Registre a devolução antes de baixar.`,
    409,
  );
}
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npm test -- --testPathPattern="models/exemplares" 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add models/exemplares.ts tests/integration/models/exemplares.test.ts
git commit -m "feat: mudarStatus inclui nome do leitor na mensagem de erro de baixa"
```

---

## Task 4: Schemas para exemplares

**Files:**

- Modify: `infra/schemas.ts`

> Sem teste unitário — schemas são exercitados pelos testes das rotas.

- [ ] **Step 1: Adicionar schemas ao final de `infra/schemas.ts`**

```typescript
export const createExemplarSchema = z.object({
  codigoTombamento: z
    .string()
    .min(1, "Código de tombamento é obrigatório.")
    .max(50, "Código de tombamento deve ter no máximo 50 caracteres."),
  estado: z.enum(["novo", "bom", "regular", "danificado"]).optional(),
  observacoes: z.string().optional(),
});

export const baixarExemplarSchema = z.object({
  motivo: z.enum(["Perdido", "Danificado", "Descartado", "Outro"], {
    error: "Selecione um motivo.",
  }),
});
```

- [ ] **Step 2: Verificar tipagem**

```bash
npm run typecheck 2>&1 | tail -20
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add infra/schemas.ts
git commit -m "feat: adiciona createExemplarSchema e baixarExemplarSchema"
```

---

## Task 5: API — `GET /api/v1/livros/[id]/exemplares`

**Files:**

- Create: `app/api/v1/livros/[id]/exemplares/route.ts`
- Create: `tests/integration/api/v1/livros/exemplares/get.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/integration/api/v1/livros/exemplares/get.test.ts`:

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let livroId: string;
let girotecaAId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA01", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
  const livro = await criarLivro();
  livroId = livro.id;
});

test("GET /api/v1/livros/[id]/exemplares retorna exemplares da giroteca", async () => {
  await criarExemplar(livroId, girotecaAId, { codigoTombamento: "001" });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body).toHaveLength(1);
  expect(body[0].codigoTombamento).toBe("001");
  expect(body[0]).toHaveProperty("nomeLeitor");
});

test("GET não retorna exemplares de outra giroteca", async () => {
  const girotecaB = await criarGiroteca({ codigo: "GB01", nome: "Giroteca B" });
  await criarExemplar(livroId, girotecaB.id, { codigoTombamento: "B-001" });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveLength(0);
});

test("GET sem auth retorna 401", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
  );
  expect(response.status).toBe(401);
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test -- --testPathPattern="livros/exemplares/get" 2>&1 | tail -20
```

Esperado: `404` (rota não existe ainda).

- [ ] **Step 3: Criar a rota GET**

Criar `app/api/v1/livros/[id]/exemplares/route.ts`:

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { listarPorLivroNaGiroteca } from "models/exemplares";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id: livroId } = await params;
    const lista = await listarPorLivroNaGiroteca(livroId, contexto);
    return Response.json(lista);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npm test -- --testPathPattern="livros/exemplares/get" 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/livros/[id]/exemplares/route.ts tests/integration/api/v1/livros/exemplares/get.test.ts
git commit -m "feat: GET /api/v1/livros/[id]/exemplares lista exemplares da giroteca"
```

---

## Task 6: API — `POST /api/v1/livros/[id]/exemplares`

**Files:**

- Modify: `app/api/v1/livros/[id]/exemplares/route.ts`
- Create: `tests/integration/api/v1/livros/exemplares/post.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/integration/api/v1/livros/exemplares/post.test.ts`:

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let livroId: string;
let girotecaAId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA02", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
  const livro = await criarLivro();
  livroId = livro.id;
});

test("POST /api/v1/livros/[id]/exemplares cria exemplar e retorna 201", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ codigoTombamento: "001", estado: "bom" }),
    },
  );

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.codigoTombamento).toBe("001");
  expect(body.girotecaId).toBe(girotecaAId);
  expect(body.status).toBe("disponivel");
});

test("POST código de tombamento duplicado na mesma giroteca retorna 409", async () => {
  await criarExemplar(livroId, girotecaAId, { codigoTombamento: "001" });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ codigoTombamento: "001" }),
    },
  );

  expect(response.status).toBe(409);
});

test("POST sem codigoTombamento retorna 400", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ estado: "bom" }),
    },
  );

  expect(response.status).toBe(400);
});

test("POST sem auth retorna 401", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoTombamento: "001" }),
    },
  );

  expect(response.status).toBe(401);
});

test("POST admin_nthe sem girotecaId retorna 403", async () => {
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  const adminCookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ codigoTombamento: "001" }),
    },
  );

  expect(response.status).toBe(403);
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test -- --testPathPattern="livros/exemplares/post" 2>&1 | tail -20
```

Esperado: `405 Method Not Allowed` (POST não existe ainda).

- [ ] **Step 3: Adicionar handler POST à rota**

Em `app/api/v1/livros/[id]/exemplares/route.ts`, adicionar após o handler GET:

```typescript
import { createExemplarSchema, parseBody } from "infra/schemas";
import { criarParaGiroteca, listarPorLivroNaGiroteca } from "models/exemplares";
```

> Atualizar o import de `models/exemplares` para incluir `criarParaGiroteca`.
> Atualizar o import de `infra/schemas` (novo import).

```typescript
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id: livroId } = await params;

    if (!contexto.girotecaId) {
      return Response.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseBody(createExemplarSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const exemplar = await criarParaGiroteca(
      {
        livroId,
        girotecaId: contexto.girotecaId,
        codigoTombamento: parsed.data.codigoTombamento,
        estado: parsed.data.estado,
        observacoes: parsed.data.observacoes,
      },
      contexto,
    );
    return Response.json(exemplar, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
```

**Nota:** A unicidade de `codigoTombamento` por giroteca é garantida pelo `uniqueIndex` no schema (`exemplares_tombamento_giroteca_idx`). Quando violado, o Postgres lança uma exceção que o Drizzle propaga como erro genérico — não um `AppError`. Para retornar 409, é necessário detectar a violação de constraint. Substituir o `catch` do POST por:

```typescript
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    if (
      error instanceof Error &&
      error.message.includes("exemplares_tombamento_giroteca_idx")
    ) {
      return Response.json(
        { error: "Já existe um exemplar com este código nesta giroteca." },
        { status: 409 },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npm test -- --testPathPattern="livros/exemplares/post" 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/livros/[id]/exemplares/route.ts tests/integration/api/v1/livros/exemplares/post.test.ts
git commit -m "feat: POST /api/v1/livros/[id]/exemplares cria exemplar na giroteca"
```

---

## Task 7: API — `GET /api/v1/exemplares/proximo-codigo`

**Files:**

- Create: `app/api/v1/exemplares/proximo-codigo/route.ts`
- Create: `tests/integration/api/v1/exemplares/proximo-codigo.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/integration/api/v1/exemplares/proximo-codigo.test.ts`:

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let girotecaAId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA03", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/exemplares/proximo-codigo retorna '1' quando não há exemplares", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaAId}`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.proximo).toBe("1");
});

test("GET retorna max+1 para códigos numéricos existentes", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaAId, { codigoTombamento: "5" });
  await criarExemplar(livro.id, girotecaAId, { codigoTombamento: "3" });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaAId}`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.proximo).toBe("6");
});

test("GET sem girotecaId retorna 400", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/proximo-codigo",
    { headers: { Cookie: cookie } },
  );
  expect(response.status).toBe(400);
});

test("GET sem auth retorna 401", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaAId}`,
  );
  expect(response.status).toBe(401);
});

test("GET gestor não pode consultar outra giroteca — retorna 403", async () => {
  const girotecaB = await criarGiroteca({ codigo: "GB03", nome: "Giroteca B" });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaB.id}`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(403);
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test -- --testPathPattern="exemplares/proximo-codigo" 2>&1 | tail -20
```

Esperado: 404.

- [ ] **Step 3: Criar a rota**

Criar `app/api/v1/exemplares/proximo-codigo/route.ts`:

```typescript
import { z } from "zod";
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { sugerirProximoCodigo } from "models/exemplares";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const girotecaId = searchParams.get("girotecaId") ?? contexto.girotecaId;

    if (!girotecaId) {
      return Response.json(
        { error: "girotecaId é obrigatório." },
        { status: 400 },
      );
    }

    if (!z.string().uuid().safeParse(girotecaId).success) {
      return Response.json({ error: "girotecaId inválido." }, { status: 400 });
    }

    const proximo = await sugerirProximoCodigo(girotecaId, contexto);
    return Response.json({ proximo });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npm test -- --testPathPattern="exemplares/proximo-codigo" 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/exemplares/proximo-codigo/route.ts tests/integration/api/v1/exemplares/proximo-codigo.test.ts
git commit -m "feat: GET /api/v1/exemplares/proximo-codigo sugere próximo tombamento"
```

---

## Task 8: API — `PATCH /api/v1/exemplares/[id]/baixar`

**Files:**

- Create: `app/api/v1/exemplares/[id]/baixar/route.ts`
- Create: `tests/integration/api/v1/exemplares/baixar.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/integration/api/v1/exemplares/baixar.test.ts`:

```typescript
import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let girotecaAId: string;
let gestorId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA04", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  const gestor = await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  gestorId = gestor.id;
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("PATCH /api/v1/exemplares/[id]/baixar baixa exemplar disponível", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "001",
    status: "disponivel",
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Perdido" }),
    },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("baixado");
  expect(body.observacoes).toBe("Perdido");
});

test("PATCH retorna 409 com nome do leitor quando exemplar está emprestado", async () => {
  const livro = await criarLivro();
  const leitor = await criarLeitor(girotecaAId, { nome: "Beatriz Sousa" });
  const exemplar = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "002",
    status: "emprestado",
  });
  await criarEmprestimo(exemplar.id, leitor.id, gestorId);

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Perdido" }),
    },
  );

  expect(response.status).toBe(409);
  const body = await response.json();
  expect(body.error).toContain("Beatriz Sousa");
});

test("PATCH sem motivo retorna 400", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "003",
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({}),
    },
  );

  expect(response.status).toBe(400);
});

test("PATCH gestor não pode baixar exemplar de outra giroteca — retorna 403", async () => {
  const girotecaB = await criarGiroteca({ codigo: "GB04", nome: "Giroteca B" });
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaB.id, {
    codigoTombamento: "B-001",
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Descartado" }),
    },
  );

  expect(response.status).toBe(403);
});

test("PATCH exemplar inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/00000000-0000-0000-0000-000000000000/baixar",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Outro" }),
    },
  );

  expect(response.status).toBe(404);
});

test("PATCH sem auth retorna 401", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/00000000-0000-0000-0000-000000000000/baixar",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "Outro" }),
    },
  );

  expect(response.status).toBe(401);
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test -- --testPathPattern="exemplares/baixar" 2>&1 | tail -20
```

Esperado: 404.

- [ ] **Step 3: Criar a rota**

Criar `app/api/v1/exemplares/[id]/baixar/route.ts`:

```typescript
import { AppError } from "infra/errors";
import { baixarExemplarSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { mudarStatus } from "models/exemplares";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(baixarExemplarSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const exemplar = await mudarStatus(
      id,
      "baixado",
      parsed.data.motivo,
      contexto,
    );
    return Response.json(exemplar);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npm test -- --testPathPattern="exemplares/baixar" 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Step 5: Rodar a suite completa**

```bash
npm test 2>&1 | tail -30
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add app/api/v1/exemplares/[id]/baixar/route.ts tests/integration/api/v1/exemplares/baixar.test.ts
git commit -m "feat: PATCH /api/v1/exemplares/[id]/baixar realiza baixa com motivo"
```

---

## Task 9: UI — `ExemplaresSection` (Server Component)

**Files:**

- Create: `app/(app)/livros/[id]/_components/exemplares-section.tsx`
- Modify: `app/(app)/livros/[id]/page.tsx`

> Verificação: visual no browser após implementação.

- [ ] **Step 1: Criar o componente**

Criar `app/(app)/livros/[id]/_components/exemplares-section.tsx`:

```tsx
import { contextoFromServerComponent } from "lib/contexto";
import { listarPorLivroNaGiroteca } from "models/exemplares";
import { AdicionarExemplarDialog } from "./adicionar-exemplar-dialog";
import { BaixarExemplarDialog } from "./baixar-exemplar-dialog";

interface Props {
  livroId: string;
}

const STATUS_CONFIG = {
  disponivel: {
    label: "Disponível",
    dotClass: "bg-green-500",
    badgeClass: "bg-green-50 text-green-700 ring-green-600/20",
  },
  emprestado: {
    label: "Emprestado",
    dotClass: "bg-yellow-500",
    badgeClass: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  },
  baixado: {
    label: "Baixado",
    dotClass: "bg-gray-400",
    badgeClass: "bg-gray-50 text-gray-600 ring-gray-500/20",
  },
} as const;

const ESTADO_LABEL = {
  novo: "Novo",
  bom: "Bom",
  regular: "Regular",
  danificado: "Danificado",
} as const;

export async function ExemplaresSection({ livroId }: Props) {
  const contexto = await contextoFromServerComponent();
  const lista = await listarPorLivroNaGiroteca(livroId, contexto);
  const podeGerenciar = !!contexto.girotecaId;

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Exemplares desta giroteca
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {lista.length}
          </span>
        </h2>
        {podeGerenciar && (
          <AdicionarExemplarDialog
            livroId={livroId}
            girotecaId={contexto.girotecaId!}
          />
        )}
      </div>

      {lista.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-500">
          Nenhum exemplar cadastrado nesta giroteca.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lista.map((exemplar) => {
            const cfg = STATUS_CONFIG[exemplar.status];
            return (
              <li
                key={exemplar.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3"
              >
                <span className="w-28 font-mono text-sm font-medium text-gray-900">
                  {exemplar.codigoTombamento}
                </span>
                <span className="w-20 text-sm text-gray-500">
                  {ESTADO_LABEL[exemplar.estado]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.badgeClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`}
                    aria-hidden="true"
                  />
                  {cfg.label}
                  {exemplar.nomeLeitor && ` — ${exemplar.nomeLeitor}`}
                </span>
                {podeGerenciar && exemplar.status !== "baixado" && (
                  <div className="ml-auto">
                    <BaixarExemplarDialog exemplar={exemplar} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Criar stubs temporários dos dialogs (para desbloquear a compilação)**

Criar `app/(app)/livros/[id]/_components/adicionar-exemplar-dialog.tsx` (stub):

```tsx
"use client";
export function AdicionarExemplarDialog(_props: {
  livroId: string;
  girotecaId: string;
}) {
  return null;
}
```

Criar `app/(app)/livros/[id]/_components/baixar-exemplar-dialog.tsx` (stub):

```tsx
"use client";
import type { ExemplarComLeitor } from "models/exemplares";
export function BaixarExemplarDialog(_props: { exemplar: ExemplarComLeitor }) {
  return null;
}
```

- [ ] **Step 3: Adicionar `ExemplaresSection` à página do livro**

Em `app/(app)/livros/[id]/page.tsx`, adicionar import e uso:

```tsx
import { ExemplaresSection } from "./_components/exemplares-section";
```

No JSX, após o bloco `</div>` que fecha o card de detalhes do livro (antes do fechamento do `div` principal):

```tsx
        </div>{/* fecha o card de detalhes */}

        <ExemplaresSection livroId={id} />
      </div>{/* fecha o max-w-2xl */}
```

- [ ] **Step 4: Verificar tipagem e lint**

```bash
npm run typecheck && npm run lint:check 2>&1 | tail -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/livros/[id]/_components/ app/(app)/livros/[id]/page.tsx
git commit -m "feat: adiciona seção de exemplares na página do livro"
```

---

## Task 10: UI — `AdicionarExemplarDialog`

**Files:**

- Modify: `app/(app)/livros/[id]/_components/adicionar-exemplar-dialog.tsx`

- [ ] **Step 1: Implementar o dialog completo**

Substituir o stub em `app/(app)/livros/[id]/_components/adicionar-exemplar-dialog.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  livroId: string;
  girotecaId: string;
}

const ESTADOS = [
  { value: "novo", label: "Novo" },
  { value: "bom", label: "Bom" },
  { value: "regular", label: "Regular" },
  { value: "danificado", label: "Danificado" },
] as const;

export function AdicionarExemplarDialog({ livroId, girotecaId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<
    "novo" | "bom" | "regular" | "danificado"
  >("bom");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  const carregarSugestao = useCallback(async () => {
    const res = await fetch(
      `/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaId}`,
    );
    if (res.ok) {
      const { proximo } = await res.json();
      setCodigo(proximo);
    }
  }, [girotecaId]);

  useEffect(() => {
    if (!open) return;
    carregarSugestao();
    const t = setTimeout(() => codigoRef.current?.select(), 80);
    return () => clearTimeout(t);
  }, [open, carregarSugestao]);

  function resetForm(novoCodigo?: string) {
    setCodigo(novoCodigo ?? "");
    setEstado("bom");
    setObservacoes("");
    setErro(null);
  }

  async function salvar(fecharApos: boolean) {
    if (!codigo.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/livros/${livroId}/exemplares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoTombamento: codigo.trim(),
          estado,
          observacoes: observacoes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao salvar exemplar.");
        return;
      }

      router.refresh();

      if (fecharApos) {
        setOpen(false);
        resetForm();
      } else {
        const n = parseInt(codigo.trim(), 10);
        const proxCodigo = !isNaN(n) ? String(n + 1) : "";
        resetForm(proxCodigo);
        if (!proxCodigo) await carregarSugestao();
        setTimeout(() => codigoRef.current?.select(), 80);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar exemplar
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar exemplar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="codigo-tombamento">
                Código de tombamento{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="codigo-tombamento"
                ref={codigoRef}
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setErro(null);
                }}
                placeholder="Ex: 001"
                aria-invalid={!!erro}
                aria-describedby={erro ? "exemplar-erro" : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estado-trigger">Estado</Label>
              <Select
                value={estado}
                onValueChange={(v) => setEstado(v as typeof estado)}
              >
                <SelectTrigger id="estado-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes-exemplar">Observações</Label>
              <Textarea
                id="observacoes-exemplar"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            {erro && (
              <p
                id="exemplar-erro"
                className="text-sm text-red-600"
                role="alert"
              >
                {erro}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => salvar(false)}
              disabled={!codigo.trim() || salvando}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e adicionar outro
            </Button>
            <Button
              type="button"
              onClick={() => salvar(true)}
              disabled={!codigo.trim() || salvando}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar tipagem**

```bash
npm run typecheck 2>&1 | tail -10
```

Esperado: sem erros.

- [ ] **Step 3: Testar manualmente no browser**

Abrir `http://localhost:3000/livros/<id-de-qualquer-livro>` logado como gestor. Verificar:

- Seção "Exemplares desta giroteca" aparece.
- Botão "Adicionar exemplar" abre o dialog.
- O campo código está pré-preenchido com "1" (ou o próximo da giroteca).
- Campo recebe foco/seleção automaticamente.
- "Salvar" fecha e atualiza a lista.
- "Salvar e adicionar outro" mantém o dialog aberto com código incrementado.
- Código duplicado exibe erro inline.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/livros/[id]/_components/adicionar-exemplar-dialog.tsx
git commit -m "feat: dialog de adição de exemplar com sugestão automática de código"
```

---

## Task 11: UI — `BaixarExemplarDialog` + integração final

**Files:**

- Modify: `app/(app)/livros/[id]/_components/baixar-exemplar-dialog.tsx`

- [ ] **Step 1: Implementar o dialog completo**

Substituir o stub em `app/(app)/livros/[id]/_components/baixar-exemplar-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExemplarComLeitor } from "models/exemplares";

interface Props {
  exemplar: ExemplarComLeitor;
}

const MOTIVOS = [
  { value: "Perdido", label: "Perdido" },
  { value: "Danificado", label: "Danificado" },
  { value: "Descartado", label: "Descartado" },
  { value: "Outro", label: "Outro" },
] as const;

export function BaixarExemplarDialog({ exemplar }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setMotivo("");
      setErro(null);
    }
  }

  async function confirmar() {
    if (!motivo) return;
    setErro(null);
    setBaixando(true);
    try {
      const res = await fetch(`/api/v1/exemplares/${exemplar.id}/baixar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });

      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao baixar exemplar.");
        return;
      }

      router.refresh();
      setOpen(false);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-gray-400 hover:text-red-600"
        onClick={() => setOpen(true)}
      >
        Baixar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixar exemplar</DialogTitle>
            <DialogDescription>
              Tombamento:{" "}
              <strong className="font-mono">{exemplar.codigoTombamento}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo-trigger">
                Motivo da baixa{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger id="motivo-trigger" className="w-full">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <TriangleAlert
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                aria-hidden="true"
              />
              <span>Tem certeza? Esta ação não pode ser desfeita.</span>
            </div>

            {erro && (
              <p className="text-sm text-red-600" role="alert">
                {erro}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={baixando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmar}
              disabled={!motivo || baixando}
            >
              {baixando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar tipagem e lint**

```bash
npm run typecheck && npm run lint:check 2>&1 | tail -20
```

Esperado: sem erros.

- [ ] **Step 3: Rodar suite completa de testes**

```bash
npm test 2>&1 | tail -30
```

Esperado: todos passando.

- [ ] **Step 4: Testar manualmente no browser**

Logar como gestor, abrir `/livros/<id>`. Verificar:

- Clicar "Baixar" em um exemplar disponível abre o dialog.
- Sem motivo selecionado, o botão "Confirmar baixa" está desabilitado.
- Após selecionar motivo e confirmar, a lista atualiza com badge "Baixado" (cinza).
- Tentar baixar exemplar emprestado: o erro exibe o nome do leitor.
- Exemplares baixados não exibem mais o botão "Baixar".

- [ ] **Step 5: Commit final**

```bash
git add app/(app)/livros/[id]/_components/baixar-exemplar-dialog.tsx
git commit -m "feat: dialog de baixa de exemplar com motivo e confirmação obrigatória"
```

---

## Self-Review

### Cobertura da spec

| Requisito                                                                | Task                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Seção exemplares em `/livros/[id]` listando cópias da giroteca           | Task 9                                                       |
| Badge verde/amarelo/preto por status                                     | Task 9 (`STATUS_CONFIG`)                                     |
| Botão "Adicionar exemplar" abre dialog (tombamento, estado, observações) | Task 10                                                      |
| Sugestão automática do próximo código                                    | Tasks 2, 7, 10                                               |
| Ação "Baixar" exige motivo via select                                    | Task 11                                                      |
| Confirmação obrigatória: "Tem certeza? Esta ação não pode ser desfeita." | Task 11                                                      |
| Bloquear baixa com empréstimo em aberto + nome do leitor                 | Tasks 3, 8                                                   |
| Unicidade do código de tombamento por giroteca                           | Garantida pelo DB (schema já existente) + erro 409 na Task 6 |
| "Salvar e adicionar outro" para velocidade                               | Task 10                                                      |
| Hierarquia visual e Gestalt                                              | Tasks 9-11 (dot + label, proximidade, separação)             |
| Testes: adicionar, duplicado, baixar com empréstimo, baixar sem          | Tasks 1, 6, 8                                                |

### Consistência de tipos

- `ExemplarComLeitor` é exportado de `models/exemplares.ts` (Task 1) e usado em `ExemplaresSection` (Task 9) e `BaixarExemplarDialog` (Task 11).
- `criarParaGiroteca`, `listarPorLivroNaGiroteca`, `sugerirProximoCodigo`, `mudarStatus` todos exportados de `models/exemplares.ts`.
- `createExemplarSchema`, `baixarExemplarSchema` exportados de `infra/schemas.ts` (Task 4), usados nas rotas (Tasks 6, 8).
