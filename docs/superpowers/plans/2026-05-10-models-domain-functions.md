# Models — Funções de domínio com testes (Milestone 2, Issue 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a camada `models/` usando Drizzle ORM, com funções de domínio para todas as 6 entidades, multi-tenancy via `Contexto`, e testes de integração contra Postgres real.

**Architecture:** Cada arquivo em `models/` exporta funções puras (não classes). Toda função que acessa dados sensíveis ao tenant recebe `contexto: Contexto` como segundo argumento e aplica filtro por `girotecaId` quando `papel !== "admin_nthe"`. `livros` é catálogo global — sem filtro por giroteca. `exemplares`, `leitores`, `emprestimos` sempre filtram por giroteca. Transações Drizzle (`db.transaction()`) para operações compostas como criar/devolver empréstimo.

**Tech Stack:** Drizzle ORM (`db` de `db/index.ts`, `db/schema.ts`), `bcryptjs`, `infra/errors.ts` (`AppError`), Jest, factories em `tests/factories/index.ts`.

---

## Contexto de design

### Tipo `Contexto` (definido em `lib/auth.ts`)

```typescript
export type Contexto = {
  usuarioId: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null; // null se admin_nthe
};
```

### Padrão de autorização nos models

```typescript
// Para entidades filtradas por giroteca:
if (
  contexto.papel === "gestor_giroteca" &&
  entidade.girotecaId !== contexto.girotecaId
) {
  throw new AppError("Não autorizado.", 403);
}

// Para operações só-admin:
if (contexto.papel !== "admin_nthe") {
  throw new AppError("Não autorizado.", 403);
}
```

### Regras de negócio de empréstimos

Definidas como constantes em `models/emprestimos.ts`:

```typescript
const MAX_EMPRESTIMOS_ATIVOS = 3;
const MAX_RENOVACOES = 2;
const DIAS_PRAZO = 14;
```

- Exemplar deve estar `disponivel`
- Leitor deve estar `ativo = true`
- Leitor não pode ter ≥ 3 empréstimos em aberto
- Leitor não pode ter empréstimo em atraso (`dataPrevistaDevolucao < now AND dataDevolucao IS NULL`)
- Não renovar se `renovacoes >= 2`
- Não renovar se empréstimo está em atraso

### Tabelas filtradas por giroteca

| Tabela        | Filtro por giroteca_id                                 |
| ------------- | ------------------------------------------------------ |
| `livros`      | Não — catálogo global                                  |
| `exemplares`  | Sim — quando papel ≠ admin                             |
| `leitores`    | Sim — quando papel ≠ admin                             |
| `emprestimos` | Sim — via join com `exemplares`                        |
| `girotecas`   | Admin vê todas; gestor vê só a própria                 |
| `usuarios`    | Admin gerencia todos; gestor só os da própria giroteca |

### Soft delete

| Entidade      | Estratégia                       |
| ------------- | -------------------------------- |
| `livros`      | `deletadoEm` timestamp           |
| `exemplares`  | `status = "baixado"`             |
| `leitores`    | `ativo = false`                  |
| `usuarios`    | `ativo = false`                  |
| `emprestimos` | Nunca deleta — histórico sagrado |

---

## Arquivos

| Arquivo                                        | Ação                                |
| ---------------------------------------------- | ----------------------------------- |
| `lib/auth.ts`                                  | Criar — tipo `Contexto`             |
| `tests/factories/index.ts`                     | Criar — factories e `limparBanco()` |
| `models/livros.ts`                             | Substituir                          |
| `models/exemplares.ts`                         | Criar (era inexistente)             |
| `models/girotecas.ts`                          | Criar (era inexistente)             |
| `models/leitores.ts`                           | Substituir `models/students.ts`     |
| `models/emprestimos.ts`                        | Substituir `models/loans.ts`        |
| `models/usuarios.ts`                           | Substituir `models/user.ts`         |
| `tests/integration/models/livros.test.ts`      | Criar                               |
| `tests/integration/models/exemplares.test.ts`  | Criar                               |
| `tests/integration/models/girotecas.test.ts`   | Criar                               |
| `tests/integration/models/leitores.test.ts`    | Criar                               |
| `tests/integration/models/emprestimos.test.ts` | Criar                               |
| `tests/integration/models/usuarios.test.ts`    | Criar                               |
| `models/books.ts`                              | Deletar (antiga)                    |
| `models/loans.ts`                              | Deletar (antiga)                    |
| `models/students.ts`                           | Deletar (antiga)                    |
| `models/user.ts`                               | Deletar (antiga)                    |

---

## Task 1: Criar branch

**Files:** nenhum

- [ ] **Step 1: Criar branch a partir de feat/issue-18-seed-dados-iniciais**

```bash
git fetch origin
git checkout -b feat/issue-19-models-domain-functions origin/feat/issue-18-seed-dados-iniciais
git branch --show-current
```

Saída esperada: `feat/issue-19-models-domain-functions`

---

## Task 2: lib/auth.ts — tipo Contexto

**Files:**

- Criar: `lib/auth.ts`

- [ ] **Step 1: Criar lib/auth.ts**

```typescript
export type Contexto = {
  usuarioId: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null;
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npm run typecheck
```

Saída esperada: zero erros novos (pode haver erros dos arquivos antigos de `models/` — ignorar por enquanto).

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: adiciona tipo Contexto em lib/auth.ts"
```

---

## Task 3: factories e helper de limpeza de banco

**Files:**

- Criar: `tests/factories/index.ts`

- [ ] **Step 1: Criar tests/factories/index.ts**

```typescript
import bcrypt from "bcryptjs";
import { db } from "db/index";
import {
  emprestimos,
  exemplares,
  girotecas,
  leitores,
  livros,
  usuarios,
} from "db/schema";

export async function criarGiroteca(
  override: Partial<typeof girotecas.$inferInsert> = {},
) {
  const [row] = await db
    .insert(girotecas)
    .values({
      codigo: `TEST-${Date.now()}`,
      nome: "Giroteca de Teste",
      escolaVinculada: "Escola de Teste",
      ...override,
    })
    .returning();
  return row;
}

export async function criarUsuario(
  override: Partial<typeof usuarios.$inferInsert> & { senha?: string } = {},
) {
  const { senha = "senha@test", ...rest } = override;
  const senhaHash = await bcrypt.hash(senha, 1); // rounds=1 para velocidade nos testes
  const [row] = await db
    .insert(usuarios)
    .values({
      nome: "Usuário de Teste",
      email: `test+${Date.now()}@test.com`,
      senhaHash,
      papel: "gestor_giroteca",
      ativo: true,
      ...rest,
    })
    .returning();
  return { ...row, _senhaPlana: senha };
}

export async function criarLivro(
  override: Partial<typeof livros.$inferInsert> = {},
) {
  const [row] = await db
    .insert(livros)
    .values({
      titulo: "Livro de Teste",
      autores: "Autor de Teste",
      origem: "central",
      ...override,
    })
    .returning();
  return row;
}

export async function criarExemplar(
  livroId: string,
  girotecaId: string,
  override: Partial<typeof exemplares.$inferInsert> = {},
) {
  const [row] = await db
    .insert(exemplares)
    .values({
      livroId,
      girotecaId,
      codigoTombamento: `TOC-${Date.now()}`,
      estado: "bom",
      status: "disponivel",
      ...override,
    })
    .returning();
  return row;
}

export async function criarLeitor(
  girotecaId: string,
  override: Partial<typeof leitores.$inferInsert> = {},
) {
  const [row] = await db
    .insert(leitores)
    .values({
      girotecaId,
      nome: "Leitor de Teste",
      matricula: `MAT-${Date.now()}`,
      tipo: "aluno",
      ativo: true,
      ...override,
    })
    .returning();
  return row;
}

export async function limparBanco() {
  // Ordem importa: FK constraints
  await db.delete(emprestimos);
  await db.delete(exemplares);
  await db.delete(leitores);
  await db.delete(livros);
  await db.delete(usuarios);
  await db.delete(girotecas);
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "factories"
```

Saída esperada: sem erros em `tests/factories/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/factories/index.ts
git commit -m "test: adiciona factories e helper limparBanco"
```

---

## Task 4: models/livros.ts

**Files:**

- Criar/Substituir: `models/livros.ts`
- Criar: `tests/integration/models/livros.test.ts`

- [ ] **Step 1: Criar tests/integration/models/livros.test.ts**

```typescript
import { atualizar, buscar, criar, listarPorIsbn } from "models/livros";
import type { Contexto } from "lib/auth";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let ctxAdmin: Contexto;
let ctxGestor: Contexto;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestor = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestor = {
    usuarioId: gestor.id,
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  };
});

test("buscar() retorna todos os livros ativos", async () => {
  await criar(
    { titulo: "Dom Casmurro", autores: "Machado de Assis" },
    ctxAdmin,
  );
  await criar({ titulo: "Vidas Secas", autores: "Graciliano Ramos" }, ctxAdmin);
  const resultado = await buscar();
  expect(resultado).toHaveLength(2);
});

test("buscar() filtra por busca textual no título", async () => {
  await criar(
    { titulo: "Dom Casmurro", autores: "Machado de Assis" },
    ctxAdmin,
  );
  await criar({ titulo: "Vidas Secas", autores: "Graciliano Ramos" }, ctxAdmin);
  const resultado = await buscar({ busca: "Dom" });
  expect(resultado).toHaveLength(1);
  expect(resultado[0].titulo).toBe("Dom Casmurro");
});

test("buscar() filtra por categoria", async () => {
  await criar(
    { titulo: "Livro Infantil", autores: "Autor", categoria: "Infantil" },
    ctxAdmin,
  );
  await criar(
    { titulo: "Livro Literatura", autores: "Autor", categoria: "Literatura" },
    ctxAdmin,
  );
  const resultado = await buscar({ categoria: "Infantil" });
  expect(resultado).toHaveLength(1);
  expect(resultado[0].titulo).toBe("Livro Infantil");
});

test("listarPorIsbn() retorna livro existente", async () => {
  await criar(
    { titulo: "Dom Casmurro", autores: "Machado", isbn: "9788535910663" },
    ctxAdmin,
  );
  const livro = await listarPorIsbn("9788535910663");
  expect(livro).not.toBeNull();
  expect(livro!.titulo).toBe("Dom Casmurro");
});

test("listarPorIsbn() retorna null para ISBN desconhecido", async () => {
  const livro = await listarPorIsbn("0000000000000");
  expect(livro).toBeNull();
});

test("criar() com admin define origem central", async () => {
  const livro = await criar({ titulo: "Central", autores: "Autor" }, ctxAdmin);
  expect(livro.origem).toBe("central");
  expect(livro.criadoPorGirotecaId).toBeNull();
});

test("criar() com gestor define origem local e vincula giroteca", async () => {
  const livro = await criar({ titulo: "Local", autores: "Autor" }, ctxGestor);
  expect(livro.origem).toBe("local");
  expect(livro.criadoPorGirotecaId).toBe(ctxGestor.girotecaId);
});

test("criar() com ISBN duplicado lança AppError 409", async () => {
  await criar({ titulo: "L1", autores: "A", isbn: "9788535910663" }, ctxAdmin);
  await expect(
    criar({ titulo: "L2", autores: "B", isbn: "9788535910663" }, ctxAdmin),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("atualizar() gestor não pode editar livro central", async () => {
  const livro = await criar({ titulo: "Central", autores: "Autor" }, ctxAdmin);
  await expect(
    atualizar(livro.id, { titulo: "Novo" }, ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("atualizar() gestor pode editar livro local próprio", async () => {
  const livro = await criar({ titulo: "Local", autores: "Eu" }, ctxGestor);
  const atualizado = await atualizar(
    livro.id,
    { titulo: "Editado" },
    ctxGestor,
  );
  expect(atualizado.titulo).toBe("Editado");
});

test("atualizar() ISBN duplicado lança AppError 409", async () => {
  const l1 = await criar(
    { titulo: "L1", autores: "A", isbn: "1111111111111" },
    ctxAdmin,
  );
  await criar({ titulo: "L2", autores: "B", isbn: "2222222222222" }, ctxAdmin);
  await expect(
    atualizar(l1.id, { isbn: "2222222222222" }, ctxAdmin),
  ).rejects.toMatchObject({ status_code: 409 });
});
```

- [ ] **Step 2: Criar models/livros.ts**

```typescript
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "db/index";
import { livros } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Livro = typeof livros.$inferSelect;

export async function buscar(
  opts: {
    busca?: string;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
  } = {},
): Promise<Livro[]> {
  const conds = [isNull(livros.deletadoEm)];

  if (opts.busca) {
    const t = `%${opts.busca.trim()}%`;
    conds.push(
      or(
        ilike(livros.titulo, t),
        ilike(livros.autores, t),
        ilike(livros.isbn, t),
      )!,
    );
  }
  if (opts.categoria) {
    conds.push(eq(livros.categoria, opts.categoria));
  }

  return db
    .select()
    .from(livros)
    .where(and(...conds))
    .orderBy(livros.titulo);
}

export async function listarPorIsbn(isbn: string): Promise<Livro | null> {
  const [row] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.isbn, isbn), isNull(livros.deletadoEm)));
  return row ?? null;
}

export async function criar(
  input: {
    titulo: string;
    autores: string;
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
    capaUrl?: string;
  },
  contexto: Contexto,
): Promise<Livro> {
  if (input.isbn) {
    const dup = await listarPorIsbn(input.isbn);
    if (dup) throw new AppError("ISBN já cadastrado.", 409);
  }

  const origem = contexto.papel === "admin_nthe" ? "central" : "local";

  const [row] = await db
    .insert(livros)
    .values({
      ...input,
      origem,
      criadoPorGirotecaId: origem === "local" ? contexto.girotecaId : null,
    })
    .returning();
  return row;
}

export async function atualizar(
  id: string,
  input: {
    titulo?: string;
    autores?: string;
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
    capaUrl?: string;
  },
  contexto: Contexto,
): Promise<Livro> {
  const [existente] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.id, id), isNull(livros.deletadoEm)));
  if (!existente) throw new AppError("Livro não encontrado.", 404);

  if (contexto.papel === "gestor_giroteca") {
    if (
      existente.origem === "central" ||
      existente.criadoPorGirotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }
  }

  if (input.isbn && input.isbn !== existente.isbn) {
    const dup = await listarPorIsbn(input.isbn);
    if (dup) throw new AppError("ISBN já cadastrado.", 409);
  }

  const [updated] = await db
    .update(livros)
    .set({ ...input, atualizadoEm: new Date() })
    .where(eq(livros.id, id))
    .returning();
  return updated;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep -E "models/livros|lib/auth"
```

Saída esperada: zero erros nesses arquivos.

- [ ] **Step 4: Commit**

```bash
git add models/livros.ts tests/integration/models/livros.test.ts
git commit -m "feat: implementa models/livros com testes de integração"
```

---

## Task 5: models/exemplares.ts

**Files:**

- Criar: `models/exemplares.ts`
- Criar: `tests/integration/models/exemplares.test.ts`

- [ ] **Step 1: Criar tests/integration/models/exemplares.test.ts**

```typescript
import {
  buscarPorTombamento,
  criarParaGiroteca,
  mudarStatus,
} from "models/exemplares";
import type { Contexto } from "lib/auth";
import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "A001", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "B001", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

test("criarParaGiroteca() gestor cria exemplar na própria giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarParaGiroteca(
    {
      livroId: livro.id,
      girotecaId: girotecaA.id,
      codigoTombamento: "A001-001",
    },
    ctxGestorA,
  );
  expect(exemplar.girotecaId).toBe(girotecaA.id);
  expect(exemplar.status).toBe("disponivel");
});

test("criarParaGiroteca() gestor não pode criar em outra giroteca", async () => {
  const livro = await criarLivro();
  await expect(
    criarParaGiroteca(
      {
        livroId: livro.id,
        girotecaId: girotecaB.id,
        codigoTombamento: "B001-001",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("buscarPorTombamento() retorna exemplar da própria giroteca", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-042",
  });
  const encontrado = await buscarPorTombamento(
    "A001-042",
    girotecaA.id,
    ctxGestorA,
  );
  expect(encontrado).not.toBeNull();
  expect(encontrado!.codigoTombamento).toBe("A001-042");
});

test("buscarPorTombamento() gestor não pode ver exemplar de outra giroteca", async () => {
  await expect(
    buscarPorTombamento("B001-001", girotecaB.id, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("mudarStatus() baixa exemplar disponível", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-010",
  });
  const atualizado = await mudarStatus(
    exemplar.id,
    "baixado",
    "Perdido",
    ctxGestorA,
  );
  expect(atualizado.status).toBe("baixado");
});

test("mudarStatus() não pode baixar exemplar emprestado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-011",
    status: "emprestado",
  });
  await expect(
    mudarStatus(exemplar.id, "baixado", "Perdido", ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("mudarStatus() gestor não pode alterar exemplar de outra giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaB.id, {
    codigoTombamento: "B001-001",
  });
  await expect(
    mudarStatus(exemplar.id, "baixado", "Perdido", ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});
```

- [ ] **Step 2: Criar models/exemplares.ts**

```typescript
import { and, eq } from "drizzle-orm";
import { db } from "db/index";
import { exemplares } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Exemplar = typeof exemplares.$inferSelect;

export async function criarParaGiroteca(
  input: {
    livroId: string;
    girotecaId: string;
    codigoTombamento: string;
    estado?: "novo" | "bom" | "regular" | "danificado";
    observacoes?: string;
  },
  contexto: Contexto,
): Promise<Exemplar> {
  if (
    contexto.papel === "gestor_giroteca" &&
    input.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .insert(exemplares)
    .values({
      livroId: input.livroId,
      girotecaId: input.girotecaId,
      codigoTombamento: input.codigoTombamento,
      estado: input.estado ?? "bom",
      status: "disponivel",
      observacoes: input.observacoes,
    })
    .returning();
  return row;
}

export async function buscarPorTombamento(
  codigoTombamento: string,
  girotecaId: string,
  contexto: Contexto,
): Promise<Exemplar | null> {
  if (
    contexto.papel === "gestor_giroteca" &&
    girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .select()
    .from(exemplares)
    .where(
      and(
        eq(exemplares.codigoTombamento, codigoTombamento),
        eq(exemplares.girotecaId, girotecaId),
      ),
    );
  return row ?? null;
}

export async function mudarStatus(
  id: string,
  status: "disponivel" | "baixado",
  observacoes: string | undefined,
  contexto: Contexto,
): Promise<Exemplar> {
  const [exemplar] = await db
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, id));
  if (!exemplar) throw new AppError("Exemplar não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    exemplar.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  if (status === "baixado" && exemplar.status === "emprestado") {
    throw new AppError(
      "Não é possível baixar exemplar com empréstimo em aberto.",
      409,
    );
  }

  const [updated] = await db
    .update(exemplares)
    .set({
      status,
      observacoes: observacoes ?? exemplar.observacoes,
      atualizadoEm: new Date(),
    })
    .where(eq(exemplares.id, id))
    .returning();
  return updated;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "models/exemplares"
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add models/exemplares.ts tests/integration/models/exemplares.test.ts
git commit -m "feat: implementa models/exemplares com testes de integração"
```

---

## Task 6: models/girotecas.ts

**Files:**

- Criar: `models/girotecas.ts`
- Criar: `tests/integration/models/girotecas.test.ts`

- [ ] **Step 1: Criar tests/integration/models/girotecas.test.ts**

```typescript
import { atualizar, criar, listar } from "models/girotecas";
import type { Contexto } from "lib/auth";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let ctxAdmin: Contexto;
let ctxGestor: Contexto;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca({ codigo: "G001", nome: "Giroteca G1" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestor = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestor = {
    usuarioId: gestor.id,
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  };
});

test("listar() admin vê todas as girotecas", async () => {
  await criarGiroteca({ codigo: "G002", nome: "Outra" });
  const lista = await listar(ctxAdmin);
  expect(lista.length).toBeGreaterThanOrEqual(2);
});

test("listar() gestor vê apenas a própria giroteca", async () => {
  await criarGiroteca({ codigo: "G002", nome: "Outra" });
  const lista = await listar(ctxGestor);
  expect(lista).toHaveLength(1);
  expect(lista[0].id).toBe(ctxGestor.girotecaId);
});

test("criar() admin cria nova giroteca", async () => {
  const g = await criar(
    {
      codigo: "NOVA",
      nome: "Nova Giroteca",
      escolaVinculada: "Escola Nova",
    },
    ctxAdmin,
  );
  expect(g.codigo).toBe("NOVA");
  expect(g.ativa).toBe(true);
});

test("criar() gestor não pode criar giroteca", async () => {
  await expect(
    criar({ codigo: "X", nome: "X", escolaVinculada: "X" }, ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("atualizar() admin atualiza nome da giroteca", async () => {
  const g = await criar(
    { codigo: "UPD", nome: "Original", escolaVinculada: "Escola" },
    ctxAdmin,
  );
  const atualizado = await atualizar(g.id, { nome: "Atualizada" }, ctxAdmin);
  expect(atualizado.nome).toBe("Atualizada");
});

test("atualizar() gestor não pode atualizar giroteca", async () => {
  await expect(
    atualizar(ctxGestor.girotecaId!, { nome: "Novo Nome" }, ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});
```

- [ ] **Step 2: Criar models/girotecas.ts**

```typescript
import { eq } from "drizzle-orm";
import { db } from "db/index";
import { girotecas } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Giroteca = typeof girotecas.$inferSelect;

export async function listar(contexto: Contexto): Promise<Giroteca[]> {
  if (contexto.papel === "admin_nthe") {
    return db.select().from(girotecas).orderBy(girotecas.nome);
  }
  return db
    .select()
    .from(girotecas)
    .where(eq(girotecas.id, contexto.girotecaId!));
}

export async function criar(
  input: {
    codigo: string;
    nome: string;
    escolaVinculada: string;
    endereco?: string;
  },
  contexto: Contexto,
): Promise<Giroteca> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }
  const [row] = await db.insert(girotecas).values(input).returning();
  return row;
}

export async function atualizar(
  id: string,
  input: {
    nome?: string;
    escolaVinculada?: string;
    endereco?: string;
    ativa?: boolean;
  },
  contexto: Contexto,
): Promise<Giroteca> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }
  const [row] = await db
    .update(girotecas)
    .set(input)
    .where(eq(girotecas.id, id))
    .returning();
  if (!row) throw new AppError("Giroteca não encontrada.", 404);
  return row;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "models/girotecas"
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add models/girotecas.ts tests/integration/models/girotecas.test.ts
git commit -m "feat: implementa models/girotecas com testes de integração"
```

---

## Task 7: models/leitores.ts

**Files:**

- Criar/Substituir: `models/leitores.ts`
- Criar: `tests/integration/models/leitores.test.ts`

- [ ] **Step 1: Criar tests/integration/models/leitores.test.ts**

```typescript
import { atualizar, buscar, criar, desativar } from "models/leitores";
import type { Contexto } from "lib/auth";
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "LA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "LB01", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

test("buscar() gestor vê leitores da própria giroteca", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaB.id, { nome: "João Sousa" });
  const lista = await buscar({}, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("buscar() admin vê leitores de todas as girotecas", async () => {
  await criarLeitor(girotecaA.id);
  await criarLeitor(girotecaB.id);
  const lista = await buscar({}, ctxAdmin);
  expect(lista).toHaveLength(2);
});

test("buscar() filtra por nome", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaA.id, {
    nome: "Carlos Sousa",
    matricula: "MAT-999",
  });
  const lista = await buscar({ busca: "Ana" }, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("criar() cria leitor na giroteca do gestor", async () => {
  const leitor = await criar(
    {
      girotecaId: girotecaA.id,
      nome: "Maria Souza",
      matricula: "2024-001",
      tipo: "aluno",
    },
    ctxGestorA,
  );
  expect(leitor.girotecaId).toBe(girotecaA.id);
  expect(leitor.ativo).toBe(true);
});

test("criar() gestor não pode criar leitor em outra giroteca", async () => {
  await expect(
    criar(
      {
        girotecaId: girotecaB.id,
        nome: "Fulano",
        matricula: "2024-002",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("atualizar() atualiza nome do leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Antigo Nome" });
  const atualizado = await atualizar(
    leitor.id,
    { nome: "Novo Nome" },
    ctxGestorA,
  );
  expect(atualizado.nome).toBe("Novo Nome");
});

test("atualizar() gestor não pode atualizar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(
    atualizar(leitor.id, { nome: "Hackeado" }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("desativar() marca leitor como inativo", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const desativado = await desativar(leitor.id, ctxGestorA);
  expect(desativado.ativo).toBe(false);
});

test("desativar() gestor não pode desativar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(desativar(leitor.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 403,
  });
});
```

- [ ] **Step 2: Criar models/leitores.ts**

```typescript
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "db/index";
import { leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Leitor = typeof leitores.$inferSelect;

export async function buscar(
  opts: { busca?: string } = {},
  contexto: Contexto,
): Promise<Leitor[]> {
  const conds = [];

  if (contexto.papel !== "admin_nthe") {
    conds.push(eq(leitores.girotecaId, contexto.girotecaId!));
  }
  if (opts.busca) {
    const t = `%${opts.busca.trim()}%`;
    conds.push(or(ilike(leitores.nome, t), ilike(leitores.matricula, t))!);
  }

  return db
    .select()
    .from(leitores)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(leitores.nome);
}

export async function criar(
  input: {
    girotecaId: string;
    nome: string;
    matricula: string;
    turma?: string;
    tipo?: "aluno" | "professor" | "funcionario";
    telefone?: string;
    responsavel?: string;
  },
  contexto: Contexto,
): Promise<Leitor> {
  if (
    contexto.papel === "gestor_giroteca" &&
    input.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .insert(leitores)
    .values({ tipo: "aluno", ativo: true, ...input })
    .returning();
  return row;
}

export async function atualizar(
  id: string,
  input: {
    nome?: string;
    turma?: string;
    telefone?: string;
    responsavel?: string;
  },
  contexto: Contexto,
): Promise<Leitor> {
  const [existente] = await db
    .select()
    .from(leitores)
    .where(eq(leitores.id, id));
  if (!existente) throw new AppError("Leitor não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    existente.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [updated] = await db
    .update(leitores)
    .set({ ...input, atualizadoEm: new Date() })
    .where(eq(leitores.id, id))
    .returning();
  return updated;
}

export async function desativar(
  id: string,
  contexto: Contexto,
): Promise<Leitor> {
  const [existente] = await db
    .select()
    .from(leitores)
    .where(eq(leitores.id, id));
  if (!existente) throw new AppError("Leitor não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    existente.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [updated] = await db
    .update(leitores)
    .set({ ativo: false, atualizadoEm: new Date() })
    .where(eq(leitores.id, id))
    .returning();
  return updated;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "models/leitores"
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add models/leitores.ts tests/integration/models/leitores.test.ts
git commit -m "feat: implementa models/leitores com testes de integração"
```

---

## Task 8: models/emprestimos.ts

**Files:**

- Criar/Substituir: `models/emprestimos.ts`
- Criar: `tests/integration/models/emprestimos.test.ts`

- [ ] **Step 1: Criar tests/integration/models/emprestimos.test.ts**

```typescript
import {
  criar,
  devolver,
  listarAtrasados,
  listarEmAberto,
  renovar,
} from "models/emprestimos";
import type { Contexto } from "lib/auth";
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";
import { db } from "db/index";
import { emprestimos } from "db/schema";
import { eq } from "drizzle-orm";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "EA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "EB01", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

test("criar() cria empréstimo e muda exemplar para emprestado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);

  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  expect(emprestimo.dataDevolucao).toBeNull();
  expect(emprestimo.renovacoes).toBe(0);

  // Verificar que exemplar ficou emprestado
  const { db: drizzleDb } = await import("db/index");
  const { exemplares } = await import("db/schema");
  const [ex] = await drizzleDb
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, exemplar.id));
  expect(ex.status).toBe("emprestado");
});

test("criar() falha se exemplar não está disponível", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaA.id);

  await expect(
    criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() falha se leitor está inativo", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id, { ativo: false });

  await expect(
    criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() falha se leitor já tem 3 empréstimos em aberto", async () => {
  const leitor = await criarLeitor(girotecaA.id);

  for (let i = 0; i < 3; i++) {
    const livro = await criarLivro();
    const exemplar = await criarExemplar(livro.id, girotecaA.id, {
      codigoTombamento: `TOCX-${i}`,
    });
    await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);
  }

  const livroExtra = await criarLivro();
  const exemplarExtra = await criarExemplar(livroExtra.id, girotecaA.id, {
    codigoTombamento: "TOCX-EXTRA",
  });
  await expect(
    criar({ exemplarId: exemplarExtra.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() falha se leitor tem empréstimo em atraso", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const empAtrasado = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );
  // Forçar data no passado diretamente no banco
  await db
    .update(emprestimos)
    .set({
      dataPrevistaDevolucao: new Date("2000-01-01"),
    })
    .where(eq(emprestimos.id, empAtrasado.id));

  const livro2 = await criarLivro();
  const exemplar2 = await criarExemplar(livro2.id, girotecaA.id, {
    codigoTombamento: "TOC-2",
  });
  await expect(
    criar({ exemplarId: exemplar2.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() gestor não pode criar empréstimo de outra giroteca", async () => {
  const livro = await criarLivro();
  const exemplarB = await criarExemplar(livro.id, girotecaB.id);
  const leitorB = await criarLeitor(girotecaB.id);

  await expect(
    criar({ exemplarId: exemplarB.id, leitorId: leitorB.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("devolver() registra devolução e libera exemplar", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  const devolvido = await devolver(emprestimo.id, ctxGestorA);
  expect(devolvido.dataDevolucao).not.toBeNull();

  const { db: drizzleDb } = await import("db/index");
  const { exemplares } = await import("db/schema");
  const [ex] = await drizzleDb
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, exemplar.id));
  expect(ex.status).toBe("disponivel");
});

test("renovar() estende prazo e incrementa renovacoes", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  const renovado = await renovar(emprestimo.id, ctxGestorA);
  expect(renovado.renovacoes).toBe(1);
  expect(
    renovado.dataPrevistaDevolucao > emprestimo.dataPrevistaDevolucao,
  ).toBe(true);
});

test("renovar() falha após 2 renovações", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await renovar(emprestimo.id, ctxGestorA);
  await renovar(emprestimo.id, ctxGestorA);

  await expect(renovar(emprestimo.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 409,
  });
});

test("renovar() falha se empréstimo está atrasado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await db
    .update(emprestimos)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eq(emprestimos.id, emprestimo.id));

  await expect(renovar(emprestimo.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 409,
  });
});

test("listarEmAberto() gestor vê apenas empréstimos da própria giroteca", async () => {
  const livroA = await criarLivro();
  const exemplarA = await criarExemplar(livroA.id, girotecaA.id);
  const leitorA = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplarA.id, leitorId: leitorA.id }, ctxGestorA);

  const livroB = await criarLivro();
  const exemplarB = await criarExemplar(livroB.id, girotecaB.id);
  const leitorB = await criarLeitor(girotecaB.id);
  const ctxGestorB: Contexto = {
    usuarioId: (
      await criarUsuario({ papel: "gestor_giroteca", girotecaId: girotecaB.id })
    ).id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };
  await criar({ exemplarId: exemplarB.id, leitorId: leitorB.id }, ctxGestorB);

  const lista = await listarEmAberto(ctxGestorA);
  expect(lista).toHaveLength(1);
});

test("listarAtrasados() retorna apenas empréstimos em atraso da giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );
  await db
    .update(emprestimos)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eq(emprestimos.id, emprestimo.id));

  const atrasados = await listarAtrasados(ctxGestorA);
  expect(atrasados).toHaveLength(1);
});
```

- [ ] **Step 2: Criar models/emprestimos.ts**

```typescript
import { and, count, eq, isNull, lt } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Emprestimo = typeof emprestimos.$inferSelect;

const MAX_EMPRESTIMOS_ATIVOS = 3;
const MAX_RENOVACOES = 2;
const DIAS_PRAZO = 14;

export async function criar(
  input: {
    exemplarId: string;
    leitorId: string;
    observacoes?: string;
  },
  contexto: Contexto,
): Promise<Emprestimo> {
  return db.transaction(async (tx) => {
    const [exemplar] = await tx
      .select()
      .from(exemplares)
      .where(eq(exemplares.id, input.exemplarId))
      .for("update");

    if (!exemplar) throw new AppError("Exemplar não encontrado.", 404);

    if (
      contexto.papel === "gestor_giroteca" &&
      exemplar.girotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }

    if (exemplar.status !== "disponivel") {
      throw new AppError("Exemplar não disponível para empréstimo.", 409);
    }

    const [leitor] = await tx
      .select()
      .from(leitores)
      .where(eq(leitores.id, input.leitorId));

    if (!leitor) throw new AppError("Leitor não encontrado.", 404);
    if (!leitor.ativo) throw new AppError("Leitor inativo.", 409);

    const [{ total }] = await tx
      .select({ total: count() })
      .from(emprestimos)
      .where(
        and(
          eq(emprestimos.leitorId, input.leitorId),
          isNull(emprestimos.dataDevolucao),
        ),
      );

    if (Number(total) >= MAX_EMPRESTIMOS_ATIVOS) {
      throw new AppError(
        "Leitor já possui o máximo de empréstimos em aberto.",
        409,
      );
    }

    const now = new Date();
    const [atrasado] = await tx
      .select()
      .from(emprestimos)
      .where(
        and(
          eq(emprestimos.leitorId, input.leitorId),
          isNull(emprestimos.dataDevolucao),
          lt(emprestimos.dataPrevistaDevolucao, now),
        ),
      );

    if (atrasado) {
      throw new AppError("Leitor possui empréstimo em atraso.", 409);
    }

    await tx
      .update(exemplares)
      .set({ status: "emprestado", atualizadoEm: now })
      .where(eq(exemplares.id, input.exemplarId));

    const dataPrevistaDevolucao = new Date(now);
    dataPrevistaDevolucao.setDate(dataPrevistaDevolucao.getDate() + DIAS_PRAZO);

    const [row] = await tx
      .insert(emprestimos)
      .values({
        exemplarId: input.exemplarId,
        leitorId: input.leitorId,
        registradoPorId: contexto.usuarioId,
        dataPrevistaDevolucao,
        observacoes: input.observacoes,
      })
      .returning();

    return row;
  });
}

export async function devolver(
  id: string,
  contexto: Contexto,
): Promise<Emprestimo> {
  return db.transaction(async (tx) => {
    const [emprestimo] = await tx
      .select()
      .from(emprestimos)
      .where(and(eq(emprestimos.id, id), isNull(emprestimos.dataDevolucao)));

    if (!emprestimo) {
      throw new AppError("Empréstimo não encontrado ou já devolvido.", 404);
    }

    const [exemplar] = await tx
      .select()
      .from(exemplares)
      .where(eq(exemplares.id, emprestimo.exemplarId));

    if (
      contexto.papel === "gestor_giroteca" &&
      exemplar!.girotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }

    const now = new Date();
    await tx
      .update(exemplares)
      .set({ status: "disponivel", atualizadoEm: now })
      .where(eq(exemplares.id, emprestimo.exemplarId));

    const [updated] = await tx
      .update(emprestimos)
      .set({ dataDevolucao: now })
      .where(eq(emprestimos.id, id))
      .returning();

    return updated;
  });
}

export async function renovar(
  id: string,
  contexto: Contexto,
): Promise<Emprestimo> {
  const [emprestimo] = await db
    .select()
    .from(emprestimos)
    .where(and(eq(emprestimos.id, id), isNull(emprestimos.dataDevolucao)));

  if (!emprestimo) {
    throw new AppError("Empréstimo não encontrado ou já devolvido.", 404);
  }

  const [exemplar] = await db
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, emprestimo.exemplarId));

  if (
    contexto.papel === "gestor_giroteca" &&
    exemplar!.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  if (emprestimo.renovacoes >= MAX_RENOVACOES) {
    throw new AppError("Limite de renovações atingido.", 409);
  }

  const now = new Date();
  if (emprestimo.dataPrevistaDevolucao < now) {
    throw new AppError("Não é possível renovar empréstimo em atraso.", 409);
  }

  const novaData = new Date(emprestimo.dataPrevistaDevolucao);
  novaData.setDate(novaData.getDate() + DIAS_PRAZO);

  const [updated] = await db
    .update(emprestimos)
    .set({
      dataPrevistaDevolucao: novaData,
      renovacoes: emprestimo.renovacoes + 1,
    })
    .where(eq(emprestimos.id, id))
    .returning();

  return updated;
}

export async function listarEmAberto(
  contexto: Contexto,
): Promise<Emprestimo[]> {
  if (contexto.papel === "admin_nthe") {
    return db
      .select()
      .from(emprestimos)
      .where(isNull(emprestimos.dataDevolucao))
      .orderBy(emprestimos.dataEmprestimo);
  }

  const cols = {
    id: emprestimos.id,
    exemplarId: emprestimos.exemplarId,
    leitorId: emprestimos.leitorId,
    registradoPorId: emprestimos.registradoPorId,
    dataEmprestimo: emprestimos.dataEmprestimo,
    dataPrevistaDevolucao: emprestimos.dataPrevistaDevolucao,
    dataDevolucao: emprestimos.dataDevolucao,
    renovacoes: emprestimos.renovacoes,
    observacoes: emprestimos.observacoes,
    criadoEm: emprestimos.criadoEm,
  };

  return db
    .select(cols)
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        eq(exemplares.girotecaId, contexto.girotecaId!),
      ),
    )
    .orderBy(emprestimos.dataEmprestimo);
}

export async function listarAtrasados(
  contexto: Contexto,
): Promise<Emprestimo[]> {
  const now = new Date();

  if (contexto.papel === "admin_nthe") {
    return db
      .select()
      .from(emprestimos)
      .where(
        and(
          isNull(emprestimos.dataDevolucao),
          lt(emprestimos.dataPrevistaDevolucao, now),
        ),
      )
      .orderBy(emprestimos.dataPrevistaDevolucao);
  }

  const cols = {
    id: emprestimos.id,
    exemplarId: emprestimos.exemplarId,
    leitorId: emprestimos.leitorId,
    registradoPorId: emprestimos.registradoPorId,
    dataEmprestimo: emprestimos.dataEmprestimo,
    dataPrevistaDevolucao: emprestimos.dataPrevistaDevolucao,
    dataDevolucao: emprestimos.dataDevolucao,
    renovacoes: emprestimos.renovacoes,
    observacoes: emprestimos.observacoes,
    criadoEm: emprestimos.criadoEm,
  };

  return db
    .select(cols)
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        lt(emprestimos.dataPrevistaDevolucao, now),
        eq(exemplares.girotecaId, contexto.girotecaId!),
      ),
    )
    .orderBy(emprestimos.dataPrevistaDevolucao);
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "models/emprestimos"
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add models/emprestimos.ts tests/integration/models/emprestimos.test.ts
git commit -m "feat: implementa models/emprestimos com testes de integração"
```

---

## Task 9: models/usuarios.ts

**Files:**

- Criar/Substituir: `models/usuarios.ts`
- Criar: `tests/integration/models/usuarios.test.ts`

- [ ] **Step 1: Criar tests/integration/models/usuarios.test.ts**

```typescript
import { autenticar, criar, listarPorGiroteca } from "models/usuarios";
import type { Contexto } from "lib/auth";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "UA01", nome: "Giroteca A" });
  const girotecaB = await criarGiroteca({ codigo: "UB01", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

test("autenticar() retorna usuário com credenciais corretas", async () => {
  const u = await criarUsuario({
    email: "usuario@test.com",
    senha: "minha@senha",
  });
  const resultado = await autenticar("usuario@test.com", "minha@senha");
  expect(resultado.id).toBe(u.id);
  expect((resultado as any).senhaHash).toBeUndefined();
});

test("autenticar() falha com senha errada", async () => {
  await criarUsuario({ email: "usuario@test.com", senha: "correta" });
  await expect(autenticar("usuario@test.com", "errada")).rejects.toMatchObject({
    status_code: 401,
  });
});

test("autenticar() falha com email inexistente", async () => {
  await expect(
    autenticar("naoexiste@test.com", "qualquer"),
  ).rejects.toMatchObject({ status_code: 401 });
});

test("criar() admin cria gestor vinculado à giroteca", async () => {
  const novo = await criar(
    {
      nome: "Novo Gestor",
      email: "novo@test.com",
      senha: "senha@forte",
      papel: "gestor_giroteca",
      girotecaId: girotecaA.id,
    },
    ctxAdmin,
  );
  expect(novo.papel).toBe("gestor_giroteca");
  expect(novo.girotecaId).toBe(girotecaA.id);
  expect((novo as any).senhaHash).toBeUndefined();
});

test("criar() gestor não pode criar usuários", async () => {
  await expect(
    criar(
      {
        nome: "Tentativa",
        email: "hack@test.com",
        senha: "senha123",
        papel: "gestor_giroteca",
        girotecaId: girotecaA.id,
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("criar() gestor sem girotecaId lança erro 400", async () => {
  await expect(
    criar(
      {
        nome: "Sem Giroteca",
        email: "semg@test.com",
        senha: "senha123",
        papel: "gestor_giroteca",
      },
      ctxAdmin,
    ),
  ).rejects.toMatchObject({ status_code: 400 });
});

test("criar() email duplicado lança AppError 409", async () => {
  await criarUsuario({ email: "dup@test.com" });
  await expect(
    criar(
      {
        nome: "Dup",
        email: "dup@test.com",
        senha: "senha123",
        papel: "gestor_giroteca",
        girotecaId: girotecaA.id,
      },
      ctxAdmin,
    ),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("listarPorGiroteca() retorna usuários da giroteca", async () => {
  await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const lista = await listarPorGiroteca(girotecaA.id, ctxAdmin);
  // admin + 2 gestores (created in beforeEach + this test)
  expect(lista.length).toBeGreaterThanOrEqual(1);
  expect(lista.every((u) => u.girotecaId === girotecaA.id)).toBe(true);
});

test("listarPorGiroteca() gestor não pode ver outra giroteca", async () => {
  const girotecaB = await criarGiroteca({ codigo: "OUTRAB", nome: "Outra" });
  await expect(
    listarPorGiroteca(girotecaB.id, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});
```

- [ ] **Step 2: Criar models/usuarios.ts**

```typescript
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "db/index";
import { usuarios } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Usuario = typeof usuarios.$inferSelect;
export type UsuarioPublico = Omit<Usuario, "senhaHash">;

function omitirSenha(u: Usuario): UsuarioPublico {
  const { senhaHash: _, ...pub } = u;
  return pub;
}

export async function autenticar(
  email: string,
  senha: string,
): Promise<UsuarioPublico> {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(
      and(
        eq(usuarios.email, email.toLowerCase().trim()),
        eq(usuarios.ativo, true),
      ),
    );

  if (!usuario) throw new AppError("Credenciais inválidas.", 401);

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) throw new AppError("Credenciais inválidas.", 401);

  return omitirSenha(usuario);
}

export async function criar(
  input: {
    nome: string;
    email: string;
    senha: string;
    papel: "admin_nthe" | "gestor_giroteca";
    girotecaId?: string;
  },
  contexto: Contexto,
): Promise<UsuarioPublico> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }

  if (input.papel === "gestor_giroteca" && !input.girotecaId) {
    throw new AppError("Gestor precisa estar vinculado a uma giroteca.", 400);
  }

  const email = input.email.toLowerCase().trim();
  const [existente] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email));
  if (existente) throw new AppError("Email já cadastrado.", 409);

  const senhaHash = await bcrypt.hash(input.senha, 10);
  const [row] = await db
    .insert(usuarios)
    .values({
      nome: input.nome,
      email,
      senhaHash,
      papel: input.papel,
      girotecaId: input.girotecaId,
      ativo: true,
    })
    .returning();

  return omitirSenha(row);
}

export async function listarPorGiroteca(
  girotecaId: string,
  contexto: Contexto,
): Promise<UsuarioPublico[]> {
  if (contexto.papel !== "admin_nthe" && contexto.girotecaId !== girotecaId) {
    throw new AppError("Não autorizado.", 403);
  }

  const rows = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.girotecaId, girotecaId), eq(usuarios.ativo, true)));

  return rows.map(omitirSenha);
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "models/usuarios"
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add models/usuarios.ts tests/integration/models/usuarios.test.ts
git commit -m "feat: implementa models/usuarios com testes de integração"
```

---

## Task 10: Remover models legados e rodar suite completa

**Files:**

- Deletar: `models/books.ts`, `models/loans.ts`, `models/students.ts`, `models/user.ts`

- [ ] **Step 1: Remover arquivos legados**

```bash
git rm models/books.ts models/loans.ts models/students.ts models/user.ts
```

- [ ] **Step 2: Verificar TypeScript (erros esperados em app/api)**

```bash
npm run typecheck 2>&1 | grep -v "app/api" | grep "error TS"
```

Saída esperada: zero erros fora de `app/api` (os API routes antigos referenciam os models removidos — serão reescritos na próxima issue).

- [ ] **Step 3: Rodar suite de testes**

```bash
npm test
```

Saída esperada: testes em `tests/integration/models/` passando. Testes em `tests/integration/api/v1/` continuam falhando (esperado — API routes usam models antigos, serão atualizados na próxima issue de M2).

Verificar no output que pelo menos os tests de models passam:

```
PASS tests/integration/models/livros.test.ts
PASS tests/integration/models/exemplares.test.ts
PASS tests/integration/models/girotecas.test.ts
PASS tests/integration/models/leitores.test.ts
PASS tests/integration/models/emprestimos.test.ts
PASS tests/integration/models/usuarios.test.ts
```

- [ ] **Step 4: Commit final**

```bash
git add -u
git commit -m "chore: remove models legados (books, loans, students, user)

Os models foram substituídos pelas novas implementações Drizzle em:
models/livros.ts, models/exemplares.ts, models/girotecas.ts,
models/leitores.ts, models/emprestimos.ts, models/usuarios.ts"
```

---

## Verificação final

```bash
npm run typecheck 2>&1 | grep -v "app/api" | grep "error TS" | wc -l
```

Saída esperada: `0` (zero erros fora dos API routes legados).

```bash
npm run lint:check
```

Saída esperada: zero erros de lint.
