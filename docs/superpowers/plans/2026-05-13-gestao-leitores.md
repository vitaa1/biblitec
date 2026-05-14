# Gestão de Leitores — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a gestão completa de leitores — model, API routes, page `/leitores`, dialogs de criação/edição e desativação.

**Architecture:** O model `models/leitores.ts` é reescrito com paginação, filtro de inativos, contador de empréstimos em aberto e validação de matrícula duplicada. Novas API routes em `/api/v1/leitores`. A page `/leitores` é Server Component que passa dados iniciais para o cliente `LeitorList`. A matrícula passa a ser nullable na DB para permitir leitores sem matrícula (não-destrutivo: só remove NOT NULL).

**Tech Stack:** Next.js 15 App Router · TypeScript estrito · Drizzle ORM · shadcn/ui (Dialog, Select, Input, Label, Button) · Sonner (toast) · Tailwind CSS v4

---

## Contexto crítico para quem implementa

- **Multi-tenancy por `giroteca_id`:** toda query em `leitores` e `emprestimos` filtra por `girotecaId` quando `contexto.papel !== 'admin_nthe'`. Sem esse filtro, dados de uma giroteca vazam para outra.
- **Rotas existentes a substituir:** `/api/v1/students` (GET + POST) já existe e será deletada ao criar `/api/v1/leitores`. Os testes em `tests/integration/api/v1/students/` serão migrados para `tests/integration/api/v1/leitores/`.
- **AppError com código:** precisamos adicionar campo `code?: string` ao `AppError` para que o cliente identifique `MATRICULA_DUPLICADA` e mostre erro inline no campo matrícula.
- **`buscar` muda de assinatura:** retorna `{ leitores: LeitorComContadores[], total: number }` ao invés de `Leitor[]`. Todos os usos existentes devem ser atualizados.
- **`desativar` muda de assinatura:** passa de `Promise<Leitor>` para `Promise<void>`. Teste existente que usa o valor de retorno deve ser corrigido.
- **Params assíncronos:** todas as rotas dinâmicas Next.js 15 usam `type Params = Promise<{ id: string }>` e `const { id } = await params`.
- **UUID validation regex:** `const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` (padrão do projeto).

## Mapa de arquivos

**Modificados:**
- `db/schema.ts` — `matricula` passa a ser nullable
- `infra/errors.ts` — adiciona `code?: string` ao AppError
- `infra/schemas.ts` — adiciona `updateLeitorSchema`, torna `matricula` opcional em `createLeitorSchema`
- `models/leitores.ts` — reescrita completa
- `tests/integration/models/leitores.test.ts` — atualiza assinaturas + novos casos
- `app/(app)/_components/header.tsx` — adiciona links de navegação

**Criados:**
- `app/api/v1/leitores/route.ts` — GET + POST
- `app/api/v1/leitores/[id]/route.ts` — PUT
- `app/api/v1/leitores/[id]/desativar/route.ts` — POST
- `tests/integration/api/v1/leitores/get.test.ts`
- `tests/integration/api/v1/leitores/post.test.ts`
- `tests/integration/api/v1/leitores/put.test.ts`
- `tests/integration/api/v1/leitores/desativar.test.ts`
- `app/(app)/leitores/page.tsx`
- `app/(app)/leitores/_components/leitor-list.tsx`
- `app/(app)/leitores/_components/leitor-dialog.tsx`
- `app/(app)/leitores/_components/desativar-leitor-dialog.tsx`

**Deletados:**
- `app/api/v1/students/route.ts` (substituída por `/api/v1/leitores/route.ts`)
- `tests/integration/api/v1/students/get.test.ts` (migrado)
- `tests/integration/api/v1/students/post.test.ts` (migrado)

---

## Task 1: Migração de schema + infra/errors.ts + infra/schemas.ts

**Files:**
- Modify: `db/schema.ts:165`
- Modify: `infra/errors.ts`
- Modify: `infra/schemas.ts`

- [ ] **Step 1: Tornar `matricula` nullable em `db/schema.ts`**

Em `db/schema.ts`, linha 165, mude:
```typescript
matricula: varchar("matricula", { length: 50 }).notNull(),
```
para:
```typescript
matricula: varchar("matricula", { length: 50 }),
```
A constraint `uniqueIndex("leitores_matricula_giroteca_idx")` continua — em PostgreSQL, valores NULL não violam unique constraints, então múltiplos leitores sem matrícula na mesma giroteca são permitidos.

- [ ] **Step 2: Gerar e aplicar a migration**

```bash
npm run db:generate
npm run db:migrate
```

Esperado: nova migration criada em `db/migrations/` e aplicada sem erros.

- [ ] **Step 3: Adicionar `code?: string` ao AppError em `infra/errors.ts`**

Substitua o arquivo inteiro por:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status_code: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isDuplicateConstraint(
  error: unknown,
  constraint: string,
): boolean {
  const cause = (error as { cause?: { constraint?: string } })?.cause;
  return cause?.constraint === constraint;
}
```

- [ ] **Step 4: Atualizar `infra/schemas.ts`**

Substitua o arquivo inteiro por:
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
  isbn: z
    .string()
    .regex(/^\d{10}$|^\d{13}$/, "ISBN inválido. Informe 10 ou 13 dígitos.")
    .optional(),
  editora: z.string().optional(),
  anoPublicacao: z.number().int().positive().optional(),
  categoria: categoriaLivroSchema,
  capaUrl: z.string().optional(),
  descricao: z.string().optional(),
});

export const updateLivroSchema = createLivroSchema.partial();

export const createLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  girotecaId: z.uuid("girotecaId deve ser um UUID válido."),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  matricula: z.string().optional(),
  turma: z.string().optional(),
  telefone: z.string().optional(),
  responsavel: z.string().optional(),
});

export const updateLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório.").optional(),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  matricula: z.string().optional().nullable(),
  turma: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  responsavel: z.string().optional().nullable(),
});

export const createEmprestimoSchema = z.object({
  exemplarId: z.uuid("exemplarId deve ser um UUID válido."),
  leitorId: z.uuid("leitorId deve ser um UUID válido."),
  observacoes: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório."),
  senha: z.string().min(1, "Senha é obrigatória."),
});

export const createUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  email: z.email("Email inválido."),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  papel: z.enum(["admin_nthe", "gestor_giroteca"]),
  girotecaId: z.uuid("girotecaId deve ser um UUID válido.").optional(),
});

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

export const createGirotecaSchema = z.object({
  codigo: z
    .string()
    .min(1, "Código é obrigatório.")
    .max(50, "Código deve ter no máximo 50 caracteres."),
  nome: z
    .string()
    .min(1, "Nome é obrigatório.")
    .max(255, "Nome deve ter no máximo 255 caracteres."),
  escolaVinculada: z
    .string()
    .min(1, "Escola vinculada é obrigatória.")
    .max(255, "Escola vinculada deve ter no máximo 255 caracteres."),
  endereco: z.string().optional(),
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

- [ ] **Step 5: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts infra/errors.ts infra/schemas.ts db/migrations/
git commit -m "feat: matrícula nullable, AppError com code, updateLeitorSchema"
```

---

## Task 2: Reescrever `models/leitores.ts` (TDD)

**Files:**
- Modify: `tests/integration/models/leitores.test.ts`
- Modify: `models/leitores.ts`

- [ ] **Step 1: Reescrever `tests/integration/models/leitores.test.ts` com todos os casos**

```typescript
import {
  atualizar,
  buscar,
  buscarPorId,
  criar,
  desativar,
} from "models/leitores";
import type { Contexto } from "lib/auth";
import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
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

// ─── buscar ───────────────────────────────────────────────────────────────────

test("buscar() gestor vê leitores da própria giroteca", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaB.id, { nome: "João Sousa" });
  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("buscar() admin vê leitores de todas as girotecas", async () => {
  await criarLeitor(girotecaA.id);
  await criarLeitor(girotecaB.id);
  const { leitores: lista } = await buscar({}, ctxAdmin);
  expect(lista).toHaveLength(2);
});

test("buscar() admin com girotecaId filtra por unidade", async () => {
  await criarLeitor(girotecaA.id, { nome: "Leitor A" });
  await criarLeitor(girotecaB.id, { nome: "Leitor B" });
  const { leitores: lista } = await buscar(
    { girotecaId: girotecaA.id },
    ctxAdmin,
  );
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Leitor A");
});

test("buscar() filtra por nome", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaA.id, { nome: "Carlos Sousa", matricula: "MAT-999" });
  const { leitores: lista } = await buscar({ busca: "Ana" }, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("buscar() busca parcial com acentuação encontra leitor", async () => {
  await criarLeitor(girotecaA.id, { nome: "João Silva" });
  const { leitores: lista } = await buscar({ busca: "joã" }, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("João Silva");
});

test("buscar() não retorna leitores inativos", async () => {
  await criarLeitor(girotecaA.id, { ativo: false });
  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista).toHaveLength(0);
});

test("buscar() retorna total correto para paginação", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana", matricula: "M1" });
  await criarLeitor(girotecaA.id, { nome: "Bruno", matricula: "M2" });
  const { total } = await buscar({}, ctxGestorA);
  expect(total).toBe(2);
});

test("buscar() retorna emprestimosEmAberto por leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  await criarEmprestimo(exemplar.id, leitor.id, admin.id);

  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista[0].emprestimosEmAberto).toBe(1);
});

test("buscar() emprestimosEmAberto é 0 quando devolvido", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  await criarEmprestimo(exemplar.id, leitor.id, admin.id, {
    dataDevolucao: new Date(),
  });

  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista[0].emprestimosEmAberto).toBe(0);
});

// ─── criar ────────────────────────────────────────────────────────────────────

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
      { girotecaId: girotecaB.id, nome: "Fulano", matricula: "2024-002" },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("criar() MATRICULA_DUPLICADA quando matrícula já existe na giroteca", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-DUPLICADA" });
  await expect(
    criar(
      {
        girotecaId: girotecaA.id,
        nome: "Outro Leitor",
        matricula: "MAT-DUPLICADA",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 409, code: "MATRICULA_DUPLICADA" });
});

test("criar() mesma matrícula em girotecas diferentes é permitida", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-001" });
  const leitor = await criar(
    { girotecaId: girotecaB.id, nome: "Leitor B", matricula: "MAT-001" },
    ctxAdmin,
  );
  expect(leitor.girotecaId).toBe(girotecaB.id);
});

// ─── atualizar ────────────────────────────────────────────────────────────────

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

// ─── desativar ────────────────────────────────────────────────────────────────

test("desativar() marca leitor como inativo", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  await desativar(leitor.id, ctxGestorA);
  const atualizado = await buscarPorId(leitor.id, ctxAdmin);
  expect(atualizado.ativo).toBe(false);
});

test("desativar() gestor não pode desativar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(desativar(leitor.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 403,
  });
});

// ─── buscarPorId ──────────────────────────────────────────────────────────────

test("buscarPorId() retorna o leitor pelo id", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Específico" });
  const encontrado = await buscarPorId(leitor.id, ctxGestorA);
  expect(encontrado.nome).toBe("Específico");
});

test("buscarPorId() gestor não vê leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(buscarPorId(leitor.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 403,
  });
});

test("buscarPorId() lança 404 quando leitor não existe", async () => {
  await expect(
    buscarPorId("00000000-0000-0000-0000-000000000000", ctxAdmin),
  ).rejects.toMatchObject({ status_code: 404 });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
npm test -- --testPathPattern="tests/integration/models/leitores"
```

Esperado: vários testes FAIL — `buscarPorId is not a function`, `buscar()` retorna array em vez de `{ leitores, total }`, `desativar` retorna Leitor, etc.

- [ ] **Step 3: Reescrever `models/leitores.ts`**

```typescript
import { and, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Leitor = typeof leitores.$inferSelect;

export type LeitorComContadores = Leitor & {
  emprestimosEmAberto: number;
  emprestimosAtrasados: number;
};

export type BuscarLeitoresInput = {
  busca?: string;
  girotecaId?: string;
  page?: number;
};

export type CriarLeitorInput = {
  girotecaId: string;
  nome: string;
  tipo?: "aluno" | "professor" | "funcionario";
  matricula?: string | null;
  turma?: string;
  telefone?: string;
  responsavel?: string;
};

export type AtualizarLeitorInput = {
  nome?: string;
  tipo?: "aluno" | "professor" | "funcionario";
  matricula?: string | null;
  turma?: string | null;
  telefone?: string | null;
  responsavel?: string | null;
};

export const LEITORES_POR_PAGINA = 50;

export async function buscar(
  filtros: BuscarLeitoresInput,
  contexto: Contexto,
): Promise<{ leitores: LeitorComContadores[]; total: number }> {
  const page = Math.max(1, filtros.page ?? 1);
  const offset = (page - 1) * LEITORES_POR_PAGINA;

  const conds: SQL[] = [eq(leitores.ativo, true)];

  if (contexto.papel !== "admin_nthe") {
    conds.push(eq(leitores.girotecaId, contexto.girotecaId!));
  } else if (filtros.girotecaId) {
    conds.push(eq(leitores.girotecaId, filtros.girotecaId));
  }

  if (filtros.busca) {
    const t = `%${filtros.busca.trim()}%`;
    conds.push(
      or(ilike(leitores.nome, t), ilike(leitores.matricula, t))! as SQL,
    );
  }

  const where = and(...conds);

  const [{ total }] = await db
    .select({ total: count() })
    .from(leitores)
    .where(where);

  const rows = await db
    .select({
      id: leitores.id,
      girotecaId: leitores.girotecaId,
      nome: leitores.nome,
      matricula: leitores.matricula,
      turma: leitores.turma,
      tipo: leitores.tipo,
      telefone: leitores.telefone,
      responsavel: leitores.responsavel,
      ativo: leitores.ativo,
      criadoEm: leitores.criadoEm,
      atualizadoEm: leitores.atualizadoEm,
      emprestimosEmAberto: sql<number>`(
        SELECT COUNT(*) FROM emprestimos e
        WHERE e.leitor_id = ${leitores.id}
        AND e.data_devolucao IS NULL
      )`.mapWith(Number),
      emprestimosAtrasados: sql<number>`(
        SELECT COUNT(*) FROM emprestimos e
        WHERE e.leitor_id = ${leitores.id}
        AND e.data_devolucao IS NULL
        AND e.data_prevista_devolucao < NOW()
      )`.mapWith(Number),
    })
    .from(leitores)
    .where(where)
    .orderBy(leitores.nome)
    .limit(LEITORES_POR_PAGINA)
    .offset(offset);

  return { leitores: rows, total };
}

export async function buscarPorId(
  id: string,
  contexto: Contexto,
): Promise<Leitor> {
  const [leitor] = await db.select().from(leitores).where(eq(leitores.id, id));
  if (!leitor) throw new AppError("Leitor não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    leitor.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  return leitor;
}

export async function criar(
  input: CriarLeitorInput,
  contexto: Contexto,
): Promise<Leitor> {
  if (
    contexto.papel === "gestor_giroteca" &&
    input.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  if (input.matricula) {
    const [existe] = await db
      .select({ id: leitores.id })
      .from(leitores)
      .where(
        and(
          eq(leitores.girotecaId, input.girotecaId),
          eq(leitores.matricula, input.matricula),
        ),
      );
    if (existe) {
      throw new AppError(
        "Já existe um leitor com esta matrícula nesta giroteca.",
        409,
        "MATRICULA_DUPLICADA",
      );
    }
  }

  const [row] = await db
    .insert(leitores)
    .values({ tipo: "aluno", ativo: true, ...input })
    .returning();
  return row;
}

export async function atualizar(
  id: string,
  input: AtualizarLeitorInput,
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

  if (input.matricula && input.matricula !== existente.matricula) {
    const [existe] = await db
      .select({ id: leitores.id })
      .from(leitores)
      .where(
        and(
          eq(leitores.girotecaId, existente.girotecaId),
          eq(leitores.matricula, input.matricula),
        ),
      );
    if (existe) {
      throw new AppError(
        "Já existe um leitor com esta matrícula nesta giroteca.",
        409,
        "MATRICULA_DUPLICADA",
      );
    }
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
): Promise<void> {
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

  await db
    .update(leitores)
    .set({ ativo: false, atualizadoEm: new Date() })
    .where(eq(leitores.id, id));
}
```

- [ ] **Step 4: Rodar testes do model e verificar que passam**

```bash
npm test -- --testPathPattern="tests/integration/models/leitores"
```

Esperado: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add models/leitores.ts tests/integration/models/leitores.test.ts
git commit -m "feat: reescreve models/leitores com paginação, LeitorComContadores e buscarPorId"
```

---

## Task 3: API routes GET + POST `/api/v1/leitores` (TDD)

**Files:**
- Create: `tests/integration/api/v1/leitores/get.test.ts`
- Create: `tests/integration/api/v1/leitores/post.test.ts`
- Create: `app/api/v1/leitores/route.ts`

- [ ] **Step 1: Criar `tests/integration/api/v1/leitores/get.test.ts`**

```typescript
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

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
    girotecaId: girotecaA.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0].trim();

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/leitores retorna lista paginada", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Lúcia", matricula: "MAT-001" });

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: adminCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.leitores)).toBe(true);
  expect(typeof body.total).toBe("number");
  expect(body.leitores.some((l: { nome: string }) => l.nome === "Ana Lúcia")).toBe(true);
});

test("GET /api/v1/leitores gestor só vê leitores da própria giroteca", async () => {
  await criarLeitor(girotecaA.id, { nome: "Leitor A", matricula: "A001" });
  await criarLeitor(girotecaB.id, { nome: "Leitor B", matricula: "B001" });

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.leitores.every((l: { girotecaId: string }) => l.girotecaId === girotecaA.id)).toBe(true);
  expect(body.leitores.some((l: { nome: string }) => l.nome === "Leitor B")).toBe(false);
});

test("GET /api/v1/leitores admin filtra por girotecaId", async () => {
  await criarLeitor(girotecaA.id, { nome: "Leitor A", matricula: "A001" });
  await criarLeitor(girotecaB.id, { nome: "Leitor B", matricula: "B001" });

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores?girotecaId=${girotecaA.id}`,
    { headers: { Cookie: adminCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.leitores).toHaveLength(1);
  expect(body.leitores[0].nome).toBe("Leitor A");
});

test("GET /api/v1/leitores filtra por busca parcial", async () => {
  await criarLeitor(girotecaA.id, { nome: "João Silva", matricula: "A001" });
  await criarLeitor(girotecaA.id, { nome: "Maria Souza", matricula: "A002" });

  const res = await fetch("http://localhost:3000/api/v1/leitores?q=jo%C3%A3", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.leitores).toHaveLength(1);
  expect(body.leitores[0].nome).toBe("João Silva");
});

test("GET /api/v1/leitores retorna emprestimosEmAberto", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  expect(leitor).toBeDefined();

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(typeof body.leitores[0].emprestimosEmAberto).toBe("number");
});

test("GET /api/v1/leitores sem auth retorna 401", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores");
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Criar `tests/integration/api/v1/leitores/post.test.ts`**

```typescript
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

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
    girotecaId: girotecaA.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0].trim();

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/leitores cria leitor e retorna 201", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Ana Lúcia",
      matricula: "MAT-001",
      girotecaId: girotecaA.id,
    }),
  });

  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.nome).toBe("Ana Lúcia");
  expect(body.girotecaId).toBe(girotecaA.id);
  expect(body.id).toBeDefined();
});

test("POST /api/v1/leitores sem girotecaId retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ nome: "Ana Lúcia" }),
  });
  expect(res.status).toBe(400);
});

test("POST /api/v1/leitores matrícula duplicada retorna 409 com code", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-DUP" });

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      nome: "Outro Leitor",
      matricula: "MAT-DUP",
      girotecaId: girotecaA.id,
    }),
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("MATRICULA_DUPLICADA");
});

test("POST /api/v1/leitores gestor não pode criar em outra giroteca", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      nome: "Invasor",
      girotecaId: girotecaB.id,
    }),
  });
  expect(res.status).toBe(403);
});

test("POST /api/v1/leitores sem auth retorna 401", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Ana", girotecaId: girotecaA.id }),
  });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 3: Rodar para confirmar que os testes falham**

```bash
npm test -- --testPathPattern="tests/integration/api/v1/leitores/(get|post)"
```

Esperado: FAIL — rota `/api/v1/leitores` não existe ainda.

- [ ] **Step 4: Criar `app/api/v1/leitores/route.ts`**

```typescript
import { AppError } from "infra/errors";
import { createLeitorSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { buscar, criar } from "models/leitores";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("q") ?? undefined;
    const girotecaId = searchParams.get("girotecaId") ?? undefined;
    const page = Number(searchParams.get("page")) || 1;

    const resultado = await buscar({ busca, girotecaId, page }, contexto);
    return Response.json(resultado);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({ error: error.message }, { status: error.status_code });
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json().catch(() => null);
    const parsed = parseBody(createLeitorSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const leitor = await criar(parsed.data, contexto);
    return Response.json(leitor, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      const resp: Record<string, string> = { error: error.message };
      if (error.code) resp.code = error.code;
      return Response.json(resp, { status: error.status_code });
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Rodar testes e verificar que passam**

```bash
npm test -- --testPathPattern="tests/integration/api/v1/leitores/(get|post)"
```

Esperado: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/v1/leitores/route.ts tests/integration/api/v1/leitores/get.test.ts tests/integration/api/v1/leitores/post.test.ts
git commit -m "feat: GET e POST /api/v1/leitores com testes"
```

---

## Task 4: API route PUT `/api/v1/leitores/[id]` (TDD)

**Files:**
- Create: `tests/integration/api/v1/leitores/put.test.ts`
- Create: `app/api/v1/leitores/[id]/route.ts`

- [ ] **Step 1: Criar `tests/integration/api/v1/leitores/put.test.ts`**

```typescript
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const login = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = login.headers.get("set-cookie")!.split(";")[0].trim();
});

test("PUT /api/v1/leitores/[id] atualiza nome do leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Nome Antigo" });

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ nome: "Nome Novo" }),
    },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.nome).toBe("Nome Novo");
});

test("PUT /api/v1/leitores/[id] matrícula duplicada retorna 409", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-EXISTE" });
  const leitor = await criarLeitor(girotecaA.id, { matricula: "MAT-OUTRO" });

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ matricula: "MAT-EXISTE" }),
    },
  );

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("MATRICULA_DUPLICADA");
});

test("PUT /api/v1/leitores/[id] retorna 404 para leitor inexistente", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/leitores/00000000-0000-0000-0000-000000000000",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ nome: "Qualquer" }),
    },
  );
  expect(res.status).toBe(404);
});

test("PUT /api/v1/leitores/[id] gestor não pode editar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ nome: "Hackeado" }),
    },
  );
  expect(res.status).toBe(403);
});

test("PUT /api/v1/leitores/[id] ID inválido retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores/nao-e-uuid", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ nome: "Qualquer" }),
  });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Rodar para confirmar que os testes falham**

```bash
npm test -- --testPathPattern="tests/integration/api/v1/leitores/put"
```

Esperado: FAIL — rota não existe.

- [ ] **Step 3: Criar `app/api/v1/leitores/[id]/route.ts`**

```typescript
import { AppError } from "infra/errors";
import { updateLeitorSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { atualizar } from "models/leitores";

type Params = Promise<{ id: string }>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    const parsed = parseBody(updateLeitorSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const leitor = await atualizar(id, parsed.data, contexto);
    return Response.json(leitor);
  } catch (error) {
    if (error instanceof AppError) {
      const resp: Record<string, string> = { error: error.message };
      if (error.code) resp.code = error.code;
      return Response.json(resp, { status: error.status_code });
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar testes e verificar que passam**

```bash
npm test -- --testPathPattern="tests/integration/api/v1/leitores/put"
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/v1/leitores/[id]/route.ts" tests/integration/api/v1/leitores/put.test.ts
git commit -m "feat: PUT /api/v1/leitores/[id] com testes"
```

---

## Task 5: API route POST `/api/v1/leitores/[id]/desativar` + limpeza da rota legada (TDD)

**Files:**
- Create: `tests/integration/api/v1/leitores/desativar.test.ts`
- Create: `app/api/v1/leitores/[id]/desativar/route.ts`
- Delete: `app/api/v1/students/route.ts`
- Delete: `tests/integration/api/v1/students/get.test.ts`
- Delete: `tests/integration/api/v1/students/post.test.ts`

- [ ] **Step 1: Criar `tests/integration/api/v1/leitores/desativar.test.ts`**

```typescript
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const login = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = login.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/leitores/[id]/desativar retorna 204", async () => {
  const leitor = await criarLeitor(girotecaA.id);

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}/desativar`,
    { method: "POST", headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(204);
});

test("POST desativar leitor não aparece em busca posterior", async () => {
  const leitor = await criarLeitor(girotecaA.id);

  await fetch(`http://localhost:3000/api/v1/leitores/${leitor.id}/desativar`, {
    method: "POST",
    headers: { Cookie: gestorCookie },
  });

  const listaRes = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: gestorCookie },
  });
  const lista = await listaRes.json();
  expect(lista.leitores.some((l: { id: string }) => l.id === leitor.id)).toBe(false);
});

test("POST desativar retorna 404 para leitor inexistente", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/leitores/00000000-0000-0000-0000-000000000000/desativar",
    { method: "POST", headers: { Cookie: gestorCookie } },
  );
  expect(res.status).toBe(404);
});

test("POST desativar retorna 403 para leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}/desativar`,
    { method: "POST", headers: { Cookie: gestorCookie } },
  );
  expect(res.status).toBe(403);
});

test("POST desativar ID inválido retorna 400", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/leitores/nao-e-uuid/desativar",
    { method: "POST", headers: { Cookie: gestorCookie } },
  );
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Rodar para confirmar que os testes falham**

```bash
npm test -- --testPathPattern="tests/integration/api/v1/leitores/desativar"
```

Esperado: FAIL — rota não existe.

- [ ] **Step 3: Criar `app/api/v1/leitores/[id]/desativar/route.ts`**

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { desativar } from "models/leitores";

type Params = Promise<{ id: string }>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
    await desativar(id, contexto);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar testes e verificar que passam**

```bash
npm test -- --testPathPattern="tests/integration/api/v1/leitores/desativar"
```

Esperado: todos PASS.

- [ ] **Step 5: Deletar rota legada `/api/v1/students` e seus testes**

```bash
rm app/api/v1/students/route.ts
rm tests/integration/api/v1/students/get.test.ts
rm tests/integration/api/v1/students/post.test.ts
```

- [ ] **Step 6: Rodar todos os testes para confirmar que nada quebrou**

```bash
npm test
```

Esperado: todos PASS (os testes de students foram deletados junto com a rota).

- [ ] **Step 7: Commit**

```bash
git add "app/api/v1/leitores/[id]/desativar/route.ts" tests/integration/api/v1/leitores/desativar.test.ts
git rm app/api/v1/students/route.ts
git rm tests/integration/api/v1/students/get.test.ts
git rm tests/integration/api/v1/students/post.test.ts
git commit -m "feat: POST /api/v1/leitores/[id]/desativar; remove rota legada /students"
```

---

## Task 6: Página `/leitores` + componente `LeitorList`

**Files:**
- Create: `app/(app)/leitores/page.tsx`
- Create: `app/(app)/leitores/_components/leitor-list.tsx`

- [ ] **Step 1: Criar `app/(app)/leitores/page.tsx`**

```typescript
import { contextoFromServerComponent } from "lib/contexto";
import { listar } from "models/girotecas";
import { buscar, LEITORES_POR_PAGINA } from "models/leitores";
import { LeitorList } from "./_components/leitor-list";

export const metadata = { title: "Leitores — Biblitec" };

export default async function LeitoresPage() {
  const contexto = await contextoFromServerComponent();

  const [initialData, girotecas] = await Promise.all([
    buscar({ page: 1 }, contexto),
    contexto.papel === "admin_nthe" ? listar(contexto) : Promise.resolve([]),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(initialData.total / LEITORES_POR_PAGINA),
  );

  return (
    <LeitorList
      initialData={{
        leitores: initialData.leitores,
        total: initialData.total,
        page: 1,
        totalPages,
      }}
      girotecas={girotecas}
      girotecaIdContexto={contexto.girotecaId}
    />
  );
}
```

- [ ] **Step 2: Criar `app/(app)/leitores/_components/leitor-list.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Giroteca } from "models/girotecas";
import type { LeitorComContadores } from "models/leitores";

interface RespostaApi {
  leitores: LeitorComContadores[];
  total: number;
  page: number;
  totalPages: number;
}

interface Props {
  initialData: RespostaApi;
  girotecas: Giroteca[];
  girotecaIdContexto: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  aluno: "Aluno",
  professor: "Professor",
  funcionario: "Funcionário",
};

export function LeitorList({ initialData, girotecas, girotecaIdContexto }: Props) {
  const [dados, setDados] = useState<RespostaApi>(initialData);
  const [busca, setBusca] = useState("");
  const [girotecaFiltro, setGirotecaFiltro] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMounted = useRef(false);
  const buscaInputRef = useRef<HTMLInputElement>(null);

  const fetchLeitores = useCallback(
    async (
      q: string,
      girotecaId: string,
      paginaAtiva: number,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro(null);

      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (girotecaId !== "todos") params.set("girotecaId", girotecaId);
        params.set("page", String(paginaAtiva));

        const res = await fetch(`/api/v1/leitores?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          setErro("Erro ao carregar leitores. Tente novamente.");
          return;
        }

        const json = await res.json();
        setDados({ ...json, page: paginaAtiva, totalPages: Math.max(1, Math.ceil(json.total / 50)) });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setErro("Erro ao carregar leitores. Tente novamente.");
        }
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  // debounce de 300ms na busca por texto
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      fetchLeitores(busca, girotecaFiltro, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, girotecaFiltro, fetchLeitores]);

  // refetch ao trocar de página sem debounce
  useEffect(() => {
    if (!isMounted.current) return;
    fetchLeitores(busca, girotecaFiltro, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function refrescar() {
    fetchLeitores(busca, girotecaFiltro, page);
  }

  const girotecaIdParaCriacao =
    girotecaFiltro !== "todos" ? girotecaFiltro : (girotecaIdContexto ?? null);

  const podeNovoLeitor = girotecaIdParaCriacao !== null;

  const inicioExibido = (page - 1) * 50 + 1;
  const fimExibido = Math.min(page * 50, dados.total);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leitores</h1>
            <p className="mt-1 text-sm text-gray-500">
              Cadastre e gerencie os leitores da giroteca
            </p>
          </div>
          <Button
            disabled={!podeNovoLeitor}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            onClick={() => {
              /* LeitorDialog será conectado na Task 7 */
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Novo leitor
          </Button>
        </div>

        {/* Filtros */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Filtro giroteca — só admin NTE vê */}
            {girotecas.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Giroteca
                </label>
                <Select value={girotecaFiltro} onValueChange={(v) => { setGirotecaFiltro(v); setPage(1); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as girotecas</SelectItem>
                    {girotecas.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campo de busca */}
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="busca-leitor" className="text-sm font-medium text-gray-700">
                Buscar
              </label>
              <div className="relative">
                <input
                  ref={buscaInputRef}
                  id="busca-leitor"
                  type="search"
                  placeholder="Buscar por nome ou matrícula…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => { setBusca(""); buscaInputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {busca && (
                <span className="inline-flex items-center gap-1 self-start rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Buscando: &ldquo;{busca}&rdquo;
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {carregando ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Carregando…
            </div>
          ) : erro ? (
            <div className="px-6 py-12 text-center text-sm text-red-600">{erro}</div>
          ) : dados.leitores.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <p className="text-sm text-gray-500">
                {busca
                  ? `Nenhum leitor encontrado para "${busca}". Verifique a grafia ou cadastre um novo leitor.`
                  : "Nenhum leitor cadastrado."}
              </p>
              {podeNovoLeitor && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => { /* conectar na Task 7 */ }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Novo leitor
                </Button>
              )}
            </div>
          ) : (
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-100">
                {dados.leitores.map((leitor) => (
                  <tr
                    key={leitor.id}
                    className="group hover:bg-gray-50"
                  >
                    {/* Nome + tipo + turma */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {leitor.nome}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {leitor.turma && `${leitor.turma} · `}
                        {TIPO_LABEL[leitor.tipo ?? "aluno"]}
                      </p>
                    </td>

                    {/* Badge empréstimos em aberto */}
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      {leitor.emprestimosEmAberto > 0 && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            leitor.emprestimosAtrasados > 0
                              ? "bg-red-50 text-red-700 ring-red-600/20"
                              : "bg-blue-50 text-blue-700 ring-blue-600/20"
                          }`}
                        >
                          {leitor.emprestimosEmAberto} em aberto
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Editar ${leitor.nome}`}
                          onClick={() => { /* conectar na Task 7 */ }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Desativar ${leitor.nome}`}
                          onClick={() => { /* conectar na Task 8 */ }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação e contagem */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {dados.total > 0
              ? `Mostrando ${inicioExibido}–${fimExibido} de ${dados.total}`
              : "0 leitores"}
          </p>
          {dados.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || carregando}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-gray-500">
                Página {page} de {dados.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= dados.totalPages || carregando}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck e lint**

```bash
npm run typecheck && npm run lint:check
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/leitores/"
git commit -m "feat: página /leitores com LeitorList, busca e paginação"
```

---

## Task 7: Dialog `LeitorDialog` (criar e editar)

**Files:**
- Create: `app/(app)/leitores/_components/leitor-dialog.tsx`
- Modify: `app/(app)/leitores/_components/leitor-list.tsx`

- [ ] **Step 1: Criar `app/(app)/leitores/_components/leitor-dialog.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
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
import type { LeitorComContadores } from "models/leitores";

type TipoLeitor = "aluno" | "professor" | "funcionario";

interface FormState {
  nome: string;
  tipo: TipoLeitor;
  matricula: string;
  turma: string;
  telefone: string;
  responsavel: string;
}

const FORM_VAZIO: FormState = {
  nome: "",
  tipo: "aluno",
  matricula: "",
  turma: "",
  telefone: "",
  responsavel: "",
};

interface Props {
  girotecaId: string;
  leitor?: LeitorComContadores | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LeitorDialog({
  girotecaId,
  leitor,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const modoEdicao = leitor != null;
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erroMatricula, setErroMatricula] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  // Preenche formulário ao abrir para edição
  useEffect(() => {
    if (open) {
      if (leitor) {
        setForm({
          nome: leitor.nome,
          tipo: (leitor.tipo as TipoLeitor) ?? "aluno",
          matricula: leitor.matricula ?? "",
          turma: leitor.turma ?? "",
          telefone: leitor.telefone ?? "",
          responsavel: leitor.responsavel ?? "",
        });
      } else {
        setForm(FORM_VAZIO);
      }
      setErroMatricula(null);
      setErroGeral(null);
    }
  }, [open, leitor]);

  // Autofoco no nome ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => nomeRef.current?.focus(), 50);
    }
  }, [open]);

  function setField(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "matricula") setErroMatricula(null);
    setErroGeral(null);
  }

  function fechar() {
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;

    setErroMatricula(null);
    setErroGeral(null);
    setSalvando(true);

    try {
      const url = modoEdicao
        ? `/api/v1/leitores/${leitor!.id}`
        : "/api/v1/leitores";
      const method = modoEdicao ? "PUT" : "POST";
      const body = modoEdicao
        ? {
            nome: form.nome.trim(),
            tipo: form.tipo,
            matricula: form.matricula.trim() || null,
            turma: form.turma.trim() || null,
            telefone: form.telefone.trim() || null,
            responsavel: form.responsavel.trim() || null,
          }
        : {
            nome: form.nome.trim(),
            tipo: form.tipo,
            girotecaId,
            matricula: form.matricula.trim() || undefined,
            turma: form.turma.trim() || undefined,
            telefone: form.telefone.trim() || undefined,
            responsavel: form.responsavel.trim() || undefined,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === "MATRICULA_DUPLICADA") {
          setErroMatricula(
            "Já existe um leitor com esta matrícula nesta giroteca.",
          );
          return;
        }
        setErroGeral(data.error ?? "Erro ao salvar leitor.");
        return;
      }

      const salvo = await res.json();
      toast(
        modoEdicao
          ? `Dados de ${salvo.nome} atualizados.`
          : `Leitor ${salvo.nome} cadastrado com sucesso.`,
      );
      onSuccess();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  const podeConfirmar = Boolean(form.nome.trim()) && !salvando;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {modoEdicao ? `Editar ${leitor!.nome}` : "Novo leitor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2" noValidate>
          {/* Grupo identidade */}
          <fieldset className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="leitor-nome">
                Nome completo{" "}
                <span className="text-red-500" aria-hidden="true">*</span>
              </Label>
              <Input
                ref={nomeRef}
                id="leitor-nome"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex: João Silva"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="leitor-tipo">
                Tipo{" "}
                <span className="text-red-500" aria-hidden="true">*</span>
              </Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setField("tipo", v)}
              >
                <SelectTrigger id="leitor-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aluno">Aluno</SelectItem>
                  <SelectItem value="professor">Professor</SelectItem>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="leitor-matricula">Matrícula (opcional)</Label>
              <Input
                id="leitor-matricula"
                value={form.matricula}
                onChange={(e) => setField("matricula", e.target.value)}
                placeholder="Ex: 2024-001"
                aria-invalid={!!erroMatricula}
                aria-describedby={
                  erroMatricula ? "leitor-matricula-erro" : undefined
                }
              />
              {erroMatricula && (
                <p
                  id="leitor-matricula-erro"
                  className="text-xs text-red-600"
                  role="alert"
                >
                  {erroMatricula}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="leitor-turma">Turma (opcional)</Label>
              <Input
                id="leitor-turma"
                value={form.turma}
                onChange={(e) => setField("turma", e.target.value)}
                placeholder="Ex: 5A"
              />
            </div>
          </fieldset>

          {/* Grupo contato */}
          <fieldset className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="leitor-telefone">Telefone (opcional)</Label>
              <Input
                id="leitor-telefone"
                value={form.telefone}
                onChange={(e) => setField("telefone", e.target.value)}
                placeholder="Ex: (86) 99999-9999"
              />
            </div>

            {/* Campo responsável — visível e obrigatório apenas para aluno */}
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out ${
                form.tipo === "aluno"
                  ? "max-h-24 opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-1.5">
                <Label htmlFor="leitor-responsavel">
                  Nome do responsável{" "}
                  <span className="text-red-500" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="leitor-responsavel"
                  value={form.responsavel}
                  onChange={(e) => setField("responsavel", e.target.value)}
                  placeholder="Ex: Maria da Silva"
                  aria-required={form.tipo === "aluno"}
                />
              </div>
            </div>
          </fieldset>

          {erroGeral && (
            <p className="text-sm text-red-600" role="alert">
              {erroGeral}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!podeConfirmar}
              className="bg-green-600 hover:bg-green-700"
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar leitor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Conectar `LeitorDialog` ao `LeitorList`**

No topo de `leitor-list.tsx`, adicione os imports:
```typescript
import { LeitorDialog } from "./leitor-dialog";
```

Dentro da função `LeitorList`, adicione os estados:
```typescript
const [dialogAberto, setDialogAberto] = useState(false);
const [leitorEditando, setLeitorEditando] = useState<LeitorComContadores | null>(null);
```

Substitua os comentários `/* LeitorDialog será conectado na Task 7 */` nos dois botões "Novo leitor" por:
```typescript
onClick={() => { setLeitorEditando(null); setDialogAberto(true); }}
```

Substitua o comentário `/* conectar na Task 7 */` no botão Editar por:
```typescript
onClick={() => { setLeitorEditando(leitor); setDialogAberto(true); }}
```

Antes do fechamento da `</div>` principal, adicione:
```typescript
{podeNovoLeitor && (
  <LeitorDialog
    girotecaId={girotecaIdParaCriacao!}
    leitor={leitorEditando}
    open={dialogAberto}
    onOpenChange={setDialogAberto}
    onSuccess={() => { refrescar(); buscaInputRef.current?.focus(); }}
  />
)}
```

- [ ] **Step 3: Verificar typecheck e lint**

```bash
npm run typecheck && npm run lint:check
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/leitores/_components/leitor-dialog.tsx" "app/(app)/leitores/_components/leitor-list.tsx"
git commit -m "feat: LeitorDialog para criar e editar leitores"
```

---

## Task 8: `DesativarLeitorDialog` + link de navegação no header

**Files:**
- Create: `app/(app)/leitores/_components/desativar-leitor-dialog.tsx`
- Modify: `app/(app)/leitores/_components/leitor-list.tsx`
- Modify: `app/(app)/_components/header.tsx`

- [ ] **Step 1: Criar `app/(app)/leitores/_components/desativar-leitor-dialog.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeitorComContadores } from "models/leitores";

interface Props {
  leitor: LeitorComContadores | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DesativarLeitorDialog({
  leitor,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    onOpenChange(false);
    setErro(null);
  }

  async function confirmar() {
    if (!leitor) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(
        `/api/v1/leitores/${leitor.id}/desativar`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json();
        setErro(data.error ?? "Erro ao desativar leitor.");
        return;
      }
      toast(`${leitor.nome} foi desativado.`);
      onSuccess();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  if (!leitor) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar {leitor.nome}?</DialogTitle>
          <DialogDescription>
            Este leitor não poderá fazer novos empréstimos. Empréstimos em
            aberto não são afetados.
          </DialogDescription>
        </DialogHeader>

        {leitor.emprestimosEmAberto > 0 && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/20">
            Atenção: este leitor tem{" "}
            <strong>{leitor.emprestimosEmAberto}</strong> empréstimo
            {leitor.emprestimosEmAberto !== 1 ? "s" : ""} em aberto.
          </p>
        )}

        {erro && (
          <p className="text-sm text-red-600" role="alert">
            {erro}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={salvando}
            aria-label={`Confirmar desativação de ${leitor.nome}`}
          >
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Conectar `DesativarLeitorDialog` ao `LeitorList`**

No topo de `leitor-list.tsx`, adicione o import:
```typescript
import { DesativarLeitorDialog } from "./desativar-leitor-dialog";
```

Dentro da função `LeitorList`, adicione os estados:
```typescript
const [desativarAberto, setDesativarAberto] = useState(false);
const [leitorDesativando, setLeitorDesativando] = useState<LeitorComContadores | null>(null);
```

Substitua o comentário `/* conectar na Task 8 */` no botão X (Desativar):
```typescript
onClick={() => { setLeitorDesativando(leitor); setDesativarAberto(true); }}
```

Antes do fechamento da `</div>` principal (após o bloco do `LeitorDialog`), adicione:
```typescript
<DesativarLeitorDialog
  leitor={leitorDesativando}
  open={desativarAberto}
  onOpenChange={setDesativarAberto}
  onSuccess={refrescar}
/>
```

- [ ] **Step 3: Adicionar links de navegação ao header**

Substitua `app/(app)/_components/header.tsx` por:
```typescript
import Link from "next/link";
import { LogOut } from "lucide-react";
import { contextoFromServerComponent } from "lib/contexto";
import { buscarProprioPerfil } from "models/usuarios";
import { logoutAction } from "../actions";

export async function AppHeader() {
  const contexto = await contextoFromServerComponent();
  const usuario = await buscarProprioPerfil(contexto);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-900">Biblitec</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/livros"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Catálogo
            </Link>
            <Link
              href="/leitores"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Leitores
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-600 sm:block">
            {usuario.nome}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Typecheck, lint e testes completos**

```bash
npm run lint:check && npm run typecheck && npm test
```

Esperado: todos passando.

- [ ] **Step 5: Commit final**

```bash
git add "app/(app)/leitores/_components/desativar-leitor-dialog.tsx" "app/(app)/leitores/_components/leitor-list.tsx" "app/(app)/_components/header.tsx"
git commit -m "feat: DesativarLeitorDialog e nav no header"
```

---

## Checklist de segurança antes do PR

- [ ] Toda query em `leitores` ou `emprestimos` tem filtro por `giroteca_id` quando `papel !== 'admin_nthe'`
- [ ] Teste confirmando que gestor A não vê dados de B (presente em `get.test.ts`)
- [ ] Matrícula duplicada: erro inline no campo (não só toast)
- [ ] Campo `responsavel` aparece apenas para `tipo === 'aluno'`
- [ ] `npm run lint:check && npm run typecheck && npm test` passando
- [ ] Sem `any` explícito no TypeScript
