# Migrar API routes para os novos models Drizzle (M2, Issue 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever os route handlers de `app/api/v1/` e os testes de API para usar os novos models Drizzle, eliminando a dependência nos models legados removidos na Issue 3.

**Architecture:** O middleware Edge (`middleware.ts`) verifica o JWT e injeta `x-user-id`, `x-user-papel` e `x-user-giroteca-id` como headers. Os route handlers lêem esses headers via `lib/contexto.ts` para montar o `Contexto` sem re-verificar o JWT. A autorização granular (gestor vs admin) fica nos models. O middleware só faz checagens grossas (autenticado? admin para rotas admin-only?). Testes de API usam factories (`tests/factories/index.ts`) para setup e chamadas HTTP para exercitar as rotas.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, `jose` (JWT verify no middleware), `jsonwebtoken` (JWT sign no auth/login), Zod, Jest, factories Drizzle.

---

## Contexto de design

### Como auth funciona agora (pós-M2)

```
Requisição HTTP
    ↓
middleware.ts (Edge Runtime)
  - Verifica JWT com jose
  - Se autenticado: injeta x-user-id, x-user-papel, x-user-giroteca-id
  - Se adminRoute e papel !== "admin_nthe": 403
    ↓
Route Handler (Node.js runtime)
  - Chama contextoFromRequest(request) → lê headers → Contexto
  - Chama model function(input, contexto)
  - Formata resposta HTTP
```

### Mudanças de schema que quebram os testes antigos

| Campo antigo                   | Campo novo                   | Nota                                 |
| ------------------------------ | ---------------------------- | ------------------------------------ |
| `livros.autor`                 | `livros.autores`             | plural                               |
| `livros.quantidade`            | ❌ removido                  | exemplares controlam disponibilidade |
| `livros.quantidade_disponivel` | ❌ removido                  | idem                                 |
| `emprestimos.livro_id`         | `emprestimos.exemplar_id`    | empréstimo é por exemplar físico     |
| `emprestimos.devolvido_em`     | `emprestimos.data_devolucao` | renomeado                            |
| `papel: "ADMIN"`               | `papel: "admin_nthe"`        | novo enum                            |
| `papel: "USER"`                | `papel: "gestor_giroteca"`   | novo enum                            |

### Tipo Contexto (já existe em `lib/auth.ts`)

```typescript
export type Contexto = {
  usuarioId: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null;
};
```

### Factories disponíveis (`tests/factories/index.ts`)

```typescript
criarGiroteca(override?)         // retorna Giroteca
criarUsuario(override & {senha?}) // retorna Usuario com _senhaPlana
criarLivro(override?)            // retorna Livro (origem: "central")
criarExemplar(livroId, girotecaId, override?)  // retorna Exemplar
criarLeitor(girotecaId, override?)             // retorna Leitor
limparBanco()                    // delete em ordem FK
```

---

## Arquivos

| Arquivo                                            | Ação                                                         |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `middleware.ts`                                    | Modificar — novos roles, novos headers, nova adminList       |
| `lib/contexto.ts`                                  | Criar — lê headers, monta Contexto                           |
| `models/livros.ts`                                 | Modificar — adicionar `buscarPorId` e `remover`              |
| `infra/schemas.ts`                                 | Modificar — substituir schemas legados                       |
| `app/api/v1/auth/login/route.ts`                   | Modificar — usar `autenticar()`                              |
| `app/api/v1/users/route.ts`                        | Modificar — usar `criar()`, sem bootstrap                    |
| `app/api/v1/books/route.ts`                        | Modificar — usar `buscar()` e `criar()`                      |
| `app/api/v1/books/[id]/route.ts`                   | Modificar — usar `buscarPorId()`, `atualizar()`, `remover()` |
| `app/api/v1/students/route.ts`                     | Modificar — usar `buscar()` e `criar()` de leitores          |
| `app/api/v1/loans/route.ts`                        | Modificar — usar `listarEmAberto()` e `criar()`              |
| `app/api/v1/loans/[id]/route.ts`                   | Modificar — usar `devolver()`                                |
| `tests/integration/api/v1/auth/login/post.test.ts` | Reescrever                                                   |
| `tests/integration/api/v1/users/post.test.ts`      | Reescrever                                                   |
| `tests/integration/api/v1/books/post.test.ts`      | Reescrever                                                   |
| `tests/integration/api/v1/books/put.test.ts`       | Reescrever                                                   |
| `tests/integration/api/v1/books/delete.test.ts`    | Reescrever                                                   |
| `tests/integration/api/v1/students/post.test.ts`   | Reescrever                                                   |
| `tests/integration/api/v1/students/get.test.ts`    | Reescrever                                                   |
| `tests/integration/api/v1/loans/post.test.ts`      | Reescrever                                                   |
| `tests/integration/api/v1/loans/get.test.ts`       | Reescrever                                                   |
| `tests/integration/api/v1/loans/patch.test.ts`     | Reescrever                                                   |

---

## Task 1: middleware.ts + lib/contexto.ts

O middleware atual usa `papel: "ADMIN"` e só injeta `x-user-id` e `x-user-role`. Precisamos:

- Adicionar `girotecaId` no payload JWT verificado
- Injetar `x-user-papel` e `x-user-giroteca-id`
- Atualizar `adminRouteMatchers` (users POST → admin-only; books/students/loans → só auth, sem checagem de role no middleware)

**Files:**

- Modify: `middleware.ts`
- Create: `lib/contexto.ts`

- [ ] **Step 1: Reescrever middleware.ts**

```typescript
import { jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "lib/env";

type RouteContext = { pathname: string; method: string };

const publicRouteMatchers: Array<(ctx: RouteContext) => boolean> = [
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/login" && method === "POST",
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/logout" && method === "POST",
  ({ pathname, method }) => pathname === "/api/v1/status" && method === "GET",
  ({ pathname, method }) =>
    pathname.startsWith("/api/v1/books") && method === "GET",
];

// Rotas que exigem papel admin_nthe (verificado no middleware além do model)
const adminRouteMatchers: Array<(ctx: RouteContext) => boolean> = [
  ({ pathname }) => pathname.startsWith("/api/v1/migrations"),
  ({ pathname, method }) => pathname === "/api/v1/users" && method === "POST",
];

export async function middleware(request: NextRequest) {
  const { pathname, method } = request.nextUrl;

  const isPublicRoute = publicRouteMatchers.some((m) =>
    m({ pathname, method }),
  );
  if (isPublicRoute) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as {
      id: string;
      papel: "admin_nthe" | "gestor_giroteca";
      girotecaId: string | null;
    };

    const isAdminRoute = adminRouteMatchers.some((m) =>
      m({ pathname, method }),
    );
    if (isAdminRoute && decoded.papel !== "admin_nthe") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", decoded.id);
    requestHeaders.set("x-user-papel", decoded.papel);
    requestHeaders.set("x-user-giroteca-id", decoded.girotecaId ?? "");

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json(
      { error: "Token inválido ou expirado." },
      { status: 401 },
    );
  }
}

export const config = {
  matcher: "/api/v1/:path*",
};
```

- [ ] **Step 2: Criar lib/contexto.ts**

```typescript
import type { Contexto } from "lib/auth";
import { AppError } from "infra/errors";

export function contextoFromRequest(request: Request): Contexto {
  const usuarioId = request.headers.get("x-user-id");
  const papel = request.headers.get("x-user-papel") as
    | "admin_nthe"
    | "gestor_giroteca"
    | null;
  const girotecaIdHeader = request.headers.get("x-user-giroteca-id");

  if (!usuarioId || !papel) {
    throw new AppError("Não autenticado.", 401);
  }

  return {
    usuarioId,
    papel,
    girotecaId: girotecaIdHeader || null,
  };
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep -E "middleware|lib/contexto" | grep "error TS"
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts lib/contexto.ts
git commit -m "$(cat <<'EOF'
feat: atualiza middleware e cria lib/contexto para novos roles Drizzle

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: auth/login route + test

O route atual faz bcrypt manual. O novo usa `autenticar()` do model e inclui `girotecaId` no JWT para o middleware poder passá-lo adiante.

**Files:**

- Modify: `app/api/v1/auth/login/route.ts`
- Rewrite: `tests/integration/api/v1/auth/login/post.test.ts`

- [ ] **Step 1: Reescrever app/api/v1/auth/login/route.ts**

```typescript
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { AppError } from "infra/errors";
import { env } from "lib/env";
import { autenticar } from "models/usuarios";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senha } = body as { email?: string; senha?: string };

    if (!email || !senha) {
      return Response.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const usuario = await autenticar(email, senha);

    const token = jwt.sign(
      {
        id: usuario.id,
        papel: usuario.papel,
        girotecaId: usuario.girotecaId,
      },
      env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const response = NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 86400,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
    });

    return response;
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

- [ ] **Step 2: Reescrever tests/integration/api/v1/auth/login/post.test.ts**

Atenção: o campo no body agora é `senha`, não `password`.

```typescript
import { criarUsuario, limparBanco } from "tests/factories";

beforeEach(async () => {
  await limparBanco();
});

test("POST /api/v1/auth/login com credenciais válidas retorna 200", async () => {
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });

  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.email).toBe("admin@test.com");
  expect(body.papel).toBe("admin_nthe");
  expect(body.senhaHash).toBeUndefined();

  const cookie = response.headers.get("set-cookie");
  expect(cookie).toMatch(/token=/);
  expect(cookie).toMatch(/HttpOnly/);
});

test("POST /api/v1/auth/login com senha errada retorna 401", async () => {
  await criarUsuario({ email: "admin@test.com", senha: "correta" });

  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "errada" }),
  });

  expect(response.status).toBe(401);

  const body = await response.json();
  expect(body.error).toBe("Credenciais inválidas.");
});

test("POST /api/v1/auth/login com email inexistente retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "naoexiste@test.com", senha: "qualquer" }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/auth/login sem campos retorna 400", async () => {
  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  expect(response.status).toBe(400);
});
```

- [ ] **Step 3: Rodar o teste**

```bash
npm test -- --testPathPattern="auth/login" 2>&1 | tail -20
```

Saída esperada: 4 testes passando.

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/auth/login/route.ts tests/integration/api/v1/auth/login/post.test.ts
git commit -m "$(cat <<'EOF'
feat: migra auth/login para models/usuarios.autenticar()

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: models/livros.ts — buscarPorId e remover

O route GET /books/:id e DELETE /books/:id precisam de funções que não existem ainda no model.

`remover()` faz soft delete e verifica empréstimos em aberto (via join `emprestimos → exemplares → livro_id`).

**Files:**

- Modify: `models/livros.ts`

- [ ] **Step 1: Adicionar imports necessários no topo de models/livros.ts**

Os imports atuais são:

```typescript
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "db/index";
import { livros } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";
```

Substituir por (adicionando `count` e as tabelas `emprestimos` e `exemplares`):

```typescript
import { and, count, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, livros } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";
```

- [ ] **Step 2: Adicionar buscarPorId ao final de models/livros.ts**

```typescript
export async function buscarPorId(id: string): Promise<Livro | null> {
  const [row] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.id, id), isNull(livros.deletadoEm)));
  return row ?? null;
}
```

- [ ] **Step 3: Adicionar remover ao final de models/livros.ts**

```typescript
export async function remover(id: string, contexto: Contexto): Promise<void> {
  const [existente] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.id, id), isNull(livros.deletadoEm)));
  if (!existente) throw new AppError("Livro não encontrado.", 404);

  if (contexto.papel === "gestor_giroteca") {
    if (existente.origem === "central") {
      throw new AppError("Não autorizado.", 403);
    }
    if (existente.criadoPorGirotecaId !== contexto.girotecaId) {
      throw new AppError("Não autorizado.", 403);
    }
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(and(eq(exemplares.livroId, id), isNull(emprestimos.dataDevolucao)));

  if (Number(total) > 0) {
    throw new AppError("Livro possui empréstimos em aberto.", 409);
  }

  await db
    .update(livros)
    .set({ deletadoEm: new Date() })
    .where(eq(livros.id, id));
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "models/livros" | grep "error TS"
```

Saída esperada: zero erros.

- [ ] **Step 5: Commit**

```bash
git add models/livros.ts
git commit -m "$(cat <<'EOF'
feat: adiciona buscarPorId e remover a models/livros

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: infra/schemas.ts — substituir schemas legados

Os schemas antigos usam campos do schema legado (`autor`, `quantidade`, `livro_id`, `ADMIN`/`USER`). Precisamos substituí-los pelos schemas do novo domínio.

**Files:**

- Modify: `infra/schemas.ts`

- [ ] **Step 1: Substituir conteúdo completo de infra/schemas.ts**

```typescript
import { z } from "zod";

export const categoriaLivroSchema = z.enum([
  "Infantil",
  "Juvenil",
  "Didático",
  "Literatura",
  "Outros",
]);

export const createLivroSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório."),
  autores: z.string().min(1, "Autores é obrigatório."),
  isbn: z.string().optional(),
  editora: z.string().optional(),
  anoPublicacao: z.number().int().positive().optional(),
  categoria: categoriaLivroSchema.optional(),
  capaUrl: z.string().optional(),
});

export const updateLivroSchema = createLivroSchema.partial();

export const createLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  matricula: z.string().min(1, "Matrícula é obrigatória."),
  girotecaId: z.string().uuid("girotecaId deve ser um UUID válido."),
  turma: z.string().optional(),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  telefone: z.string().optional(),
  responsavel: z.string().optional(),
});

export const createEmprestimoSchema = z.object({
  exemplarId: z.string().uuid("exemplarId deve ser um UUID válido."),
  leitorId: z.string().uuid("leitorId deve ser um UUID válido."),
  observacoes: z.string().optional(),
});

export const createUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  email: z.email("Email inválido."),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  papel: z.enum(["admin_nthe", "gestor_giroteca"]),
  girotecaId: z.string().uuid().optional(),
});

export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  return { ok: true, data: result.data };
}
```

- [ ] **Step 2: Verificar TypeScript (erros em app/api são esperados — serão corrigidos nas tasks seguintes)**

```bash
npm run typecheck 2>&1 | grep "infra/schemas" | grep "error TS"
```

Saída esperada: zero erros em `infra/schemas.ts` em si.

- [ ] **Step 3: Commit**

```bash
git add infra/schemas.ts
git commit -m "$(cat <<'EOF'
feat: substitui schemas Zod legados pelos do novo domínio Drizzle

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: app/api/v1/users + test

O route antigo tinha flow de bootstrap (primeiro usuário sem auth). O novo é simples: sempre requer auth de admin, chama `criar()` do model.

O middleware já bloqueia não-admins antes de chegar na rota (403 via `adminRouteMatchers`). O model também bloqueia por via própria.

**Files:**

- Modify: `app/api/v1/users/route.ts`
- Rewrite: `tests/integration/api/v1/users/post.test.ts`

- [ ] **Step 1: Reescrever app/api/v1/users/route.ts**

```typescript
import { AppError } from "infra/errors";
import { createUsuarioSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criar } from "models/usuarios";

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createUsuarioSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const usuario = await criar(parsed.data, contexto);
    return Response.json(usuario, { status: 201 });
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

- [ ] **Step 2: Reescrever tests/integration/api/v1/users/post.test.ts**

```typescript
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });

  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0].trim();

  const loginGestor = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/users admin cria gestor e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Novo Gestor",
      email: "novo@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.papel).toBe("gestor_giroteca");
  expect(body.girotecaId).toBe(girotecaId);
  expect(body.senhaHash).toBeUndefined();
});

test("POST /api/v1/users sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Tentativa",
      email: "sem@auth.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/users gestor não pode criar usuários (403)", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      nome: "Tentativa",
      email: "tentativa@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(403);
});

test("POST /api/v1/users email duplicado retorna 409", async () => {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Primeiro",
      email: "dup@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Segundo",
      email: "dup@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(409);
});
```

- [ ] **Step 3: Rodar o teste**

```bash
npm test -- --testPathPattern="users/post" 2>&1 | tail -20
```

Saída esperada: 4 testes passando.

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/users/route.ts tests/integration/api/v1/users/post.test.ts
git commit -m "$(cat <<'EOF'
feat: migra /api/v1/users para models/usuarios.criar()

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: app/api/v1/books/\* + tests

GET /books e GET /books/:id são públicos (middleware deixa passar). POST/PUT/DELETE requerem auth.

Não há mais `quantidade` ou `quantidade_disponivel`. O campo é `autores` (não `autor`).

**Files:**

- Modify: `app/api/v1/books/route.ts`
- Modify: `app/api/v1/books/[id]/route.ts`
- Rewrite: `tests/integration/api/v1/books/post.test.ts`
- Rewrite: `tests/integration/api/v1/books/put.test.ts`
- Rewrite: `tests/integration/api/v1/books/delete.test.ts`

- [ ] **Step 1: Reescrever app/api/v1/books/route.ts**

```typescript
import { AppError } from "infra/errors";
import { createLivroSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { buscar, criar } from "models/livros";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;
    const livros = await buscar({ busca });
    return Response.json(livros);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createLivroSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const livro = await criar(parsed.data, contexto);
    return Response.json(livro, { status: 201 });
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

- [ ] **Step 2: Reescrever app/api/v1/books/[id]/route.ts**

```typescript
import { AppError } from "infra/errors";
import { updateLivroSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { atualizar, buscarPorId, remover } from "models/livros";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const livro = await buscarPorId(id);
    if (!livro) {
      return Response.json({ error: "Livro não encontrado." }, { status: 404 });
    }
    return Response.json(livro);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(updateLivroSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const livro = await atualizar(id, parsed.data, contexto);
    return Response.json(livro);
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

export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    await remover(id, contexto);
    return new Response(null, { status: 204 });
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

- [ ] **Step 3: Reescrever tests/integration/api/v1/books/post.test.ts**

```typescript
import { criarUsuario, limparBanco } from "tests/factories";

let cookie: string;

beforeEach(async () => {
  await limparBanco();
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/books cria livro e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      titulo: "Clean Code",
      autores: "Robert Martin",
      isbn: "9780132350884",
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.titulo).toBe("Clean Code");
  expect(body.autores).toBe("Robert Martin");
  expect(body.id).toBeDefined();
  expect(body.quantidade).toBeUndefined();
});

test("POST /api/v1/books sem autores retorna 400", async () => {
  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ titulo: "Só o título" }),
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/books ISBN duplicado retorna 409", async () => {
  const data = {
    titulo: "Clean Code",
    autores: "Robert Martin",
    isbn: "9780132350884",
  };

  await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(data),
  });

  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(data),
  });

  expect(response.status).toBe(409);
});

test("POST /api/v1/books sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo: "Teste", autores: "Autor" }),
  });

  expect(response.status).toBe(401);
});
```

- [ ] **Step 4: Reescrever tests/integration/api/v1/books/put.test.ts**

```typescript
import { criarUsuario, limparBanco } from "tests/factories";

let cookie: string;

beforeEach(async () => {
  await limparBanco();
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

async function criarLivroViaApi(c: string) {
  const res = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: c },
    body: JSON.stringify({
      titulo: "Clean Code",
      autores: "Robert Martin",
      isbn: "9780132350884",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao criar livro: ${res.status}`);
  return res.json();
}

test("PUT /api/v1/books/:id atualiza campos e retorna 200", async () => {
  const livro = await criarLivroViaApi(cookie);

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${livro.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ editora: "Prentice Hall", anoPublicacao: 2008 }),
    },
  );

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.editora).toBe("Prentice Hall");
  expect(body.anoPublicacao).toBe(2008);
  expect(body.titulo).toBe("Clean Code");
});

test("PUT /api/v1/books/:id livro inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/books/00000000-0000-0000-0000-000000000000",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ editora: "Qualquer" }),
    },
  );

  expect(response.status).toBe(404);
});
```

- [ ] **Step 5: Reescrever tests/integration/api/v1/books/delete.test.ts**

```typescript
import { eq } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares } from "db/schema";
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;

beforeEach(async () => {
  await limparBanco();
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

async function criarLivroViaApi(c: string) {
  const res = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: c },
    body: JSON.stringify({ titulo: "Clean Code", autores: "Robert Martin" }),
  });
  if (!res.ok) throw new Error(`Falha ao criar livro: ${res.status}`);
  return res.json();
}

test("DELETE /api/v1/books/:id remove livro e retorna 204", async () => {
  const livro = await criarLivroViaApi(cookie);

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${livro.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(204);

  const getRes = await fetch(`http://localhost:3000/api/v1/books/${livro.id}`);
  expect(getRes.status).toBe(404);
});

test("DELETE /api/v1/books/:id livro inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/books/00000000-0000-0000-0000-000000000000",
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("DELETE /api/v1/books/:id já deletado retorna 404", async () => {
  const livro = await criarLivroViaApi(cookie);

  await fetch(`http://localhost:3000/api/v1/books/${livro.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${livro.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("DELETE /api/v1/books/:id com empréstimo ativo retorna 409", async () => {
  // Usa factories para criar a cadeia: livro → exemplar → leitor → emprestimo
  const giroteca = await criarGiroteca();
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, giroteca.id);
  const leitor = await criarLeitor(giroteca.id);
  const registrador = await criarUsuario({
    papel: "admin_nthe",
    girotecaId: null,
  });

  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.insert(emprestimos).values({
    exemplarId: exemplar.id,
    leitorId: leitor.id,
    registradoPorId: registrador.id,
    dataPrevistaDevolucao: futureDate,
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${livro.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(409);

  const body = await response.json();
  expect(body.error).toMatch(/empréstimos em aberto/);
});
```

- [ ] **Step 6: Rodar os testes de books**

```bash
npm test -- --testPathPattern="books/" 2>&1 | tail -20
```

Saída esperada: 11 testes passando (4 post + 2 put + 4 delete + books get se existir).

- [ ] **Step 7: Commit**

```bash
git add app/api/v1/books/ tests/integration/api/v1/books/
git commit -m "$(cat <<'EOF'
feat: migra /api/v1/books para models/livros (sem quantidade, com autores)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: app/api/v1/students + tests

O model `leitores` requer `girotecaId` no body do POST. O GET usa `buscar()` que filtra por giroteca automaticamente via Contexto.

**Files:**

- Modify: `app/api/v1/students/route.ts`
- Rewrite: `tests/integration/api/v1/students/post.test.ts`
- Rewrite: `tests/integration/api/v1/students/get.test.ts`

- [ ] **Step 1: Reescrever app/api/v1/students/route.ts**

```typescript
import { AppError } from "infra/errors";
import { createLeitorSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { buscar, criar } from "models/leitores";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;
    const leitores = await buscar({ busca }, contexto);
    return Response.json(leitores);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createLeitorSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const leitor = await criar(parsed.data, contexto);
    return Response.json(leitor, { status: 201 });
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

- [ ] **Step 2: Reescrever tests/integration/api/v1/students/post.test.ts**

```typescript
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let cookie: string;
let girotecaId: string;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/students cria leitor e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      nome: "Ana Lúcia",
      matricula: "MAT-001",
      girotecaId,
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.nome).toBe("Ana Lúcia");
  expect(body.matricula).toBe("MAT-001");
  expect(body.girotecaId).toBe(girotecaId);
  expect(body.id).toBeDefined();
});

test("POST /api/v1/students sem girotecaId retorna 400", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ nome: "Ana Lúcia", matricula: "MAT-001" }),
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/students sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Ana Lúcia",
      matricula: "MAT-001",
      girotecaId,
    }),
  });

  expect(response.status).toBe(401);
});
```

- [ ] **Step 3: Reescrever tests/integration/api/v1/students/get.test.ts**

```typescript
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let girotecaId: string;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/students lista leitores", async () => {
  await criarLeitor(girotecaId, { nome: "Ana Lúcia", matricula: "MAT-001" });

  const response = await fetch("http://localhost:3000/api/v1/students", {
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.some((l: { nome: string }) => l.nome === "Ana Lúcia")).toBe(true);
});

test("GET /api/v1/students sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students");

  expect(response.status).toBe(401);
});
```

- [ ] **Step 4: Rodar os testes de students**

```bash
npm test -- --testPathPattern="students/" 2>&1 | tail -20
```

Saída esperada: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/students/ tests/integration/api/v1/students/
git commit -m "$(cat <<'EOF'
feat: migra /api/v1/students para models/leitores (com girotecaId)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: app/api/v1/loans/\* + tests

O maior impacto de schema: empréstimos agora usam `exemplarId` (não `livro_id`). O body do POST mudou completamente. Devolver retorna `Emprestimo` com `dataDevolucao` preenchido (não `status: "RETURNED"`).

**Files:**

- Modify: `app/api/v1/loans/route.ts`
- Modify: `app/api/v1/loans/[id]/route.ts`
- Rewrite: `tests/integration/api/v1/loans/post.test.ts`
- Rewrite: `tests/integration/api/v1/loans/get.test.ts`
- Rewrite: `tests/integration/api/v1/loans/patch.test.ts`

- [ ] **Step 1: Reescrever app/api/v1/loans/route.ts**

```typescript
import { AppError } from "infra/errors";
import { createEmprestimoSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criar, listarEmAberto } from "models/emprestimos";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const emprestimos = await listarEmAberto(contexto);
    return Response.json(emprestimos);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createEmprestimoSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const emprestimo = await criar(parsed.data, contexto);
    return Response.json(emprestimo, { status: 201 });
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

- [ ] **Step 2: Reescrever app/api/v1/loans/[id]/route.ts**

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { devolver } from "models/emprestimos";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const emprestimo = await devolver(id, contexto);
    return Response.json(emprestimo);
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

- [ ] **Step 3: Reescrever tests/integration/api/v1/loans/post.test.ts**

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let exemplarId: string;
let leitorId: string;
let girotecaId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, giroteca.id);
  const leitor = await criarLeitor(giroteca.id);
  exemplarId = exemplar.id;
  leitorId = leitor.id;

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/loans cria empréstimo e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.exemplarId).toBe(exemplarId);
  expect(body.leitorId).toBe(leitorId);
  expect(body.dataDevolucao).toBeNull();
  expect(body.dataPrevistaDevolucao).toBeDefined();
});

test("POST /api/v1/loans sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/loans com exemplar indisponível retorna 409", async () => {
  // primeiro empréstimo — torna o exemplar indisponível
  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  // segundo leitor tenta o mesmo exemplar
  const outroLeitor = await criarLeitor(girotecaId);

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId: outroLeitor.id }),
  });

  expect(response.status).toBe(409);
});
```

- [ ] **Step 4: Reescrever tests/integration/api/v1/loans/get.test.ts**

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let exemplarId: string;
let leitorId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, giroteca.id);
  const leitor = await criarLeitor(giroteca.id);
  exemplarId = exemplar.id;
  leitorId = leitor.id;

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/loans lista empréstimos em aberto", async () => {
  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThanOrEqual(1);
  expect(body[0].exemplarId).toBe(exemplarId);
  expect(body[0].dataDevolucao).toBeNull();
});

test("GET /api/v1/loans sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans");

  expect(response.status).toBe(401);
});
```

- [ ] **Step 5: Reescrever tests/integration/api/v1/loans/patch.test.ts**

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let exemplarId: string;
let leitorId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, giroteca.id);
  const leitor = await criarLeitor(giroteca.id);
  exemplarId = exemplar.id;
  leitorId = leitor.id;

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("PATCH /api/v1/loans/:id devolve empréstimo e retorna 200", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.dataDevolucao).not.toBeNull();
  expect(body.id).toBe(loan.id);
});

test("PATCH /api/v1/loans/:id empréstimo inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/loans/00000000-0000-0000-0000-000000000000",
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("PATCH /api/v1/loans/:id sem auth retorna 401", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/loans/00000000-0000-0000-0000-000000000000",
    { method: "PATCH" },
  );

  expect(response.status).toBe(401);
});
```

- [ ] **Step 6: Rodar os testes de loans**

```bash
npm test -- --testPathPattern="loans/" 2>&1 | tail -20
```

Saída esperada: 8 testes passando.

- [ ] **Step 7: Commit**

```bash
git add app/api/v1/loans/ tests/integration/api/v1/loans/
git commit -m "$(cat <<'EOF'
feat: migra /api/v1/loans para models/emprestimos (exemplarId, sem livro_id)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Verificação final

- [ ] **Typecheck completo (zero erros)**

```bash
npm run typecheck 2>&1 | grep "error TS"
```

Saída esperada: zero linhas.

- [ ] **Lint**

```bash
npm run lint:check
```

Saída esperada: zero erros (warnings são aceitáveis).

- [ ] **Suite completa**

```bash
npm test 2>&1 | grep -E "PASS|FAIL|Tests:"
```

Saída esperada: todos os arquivos de `tests/integration/` passando, incluindo os de API.
