# Tela de Devolução — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a tela `/devolucoes` para registrar devoluções de exemplares pelo tombamento ou ISBN, com suporte opcional a registro do estado do exemplar e fluxo de baixa para "Danificado grave".

**Architecture:** Adicionar `buscarParaDevolucao()` e estender `devolver()` em `models/emprestimos.ts`; criar endpoint GET `/api/v1/emprestimos/buscar-devolucao`; estender PATCH `/api/v1/loans/[id]` para aceitar `estadoRetorno`; página Server Component + formulário Client Component em `app/(app)/devolucoes/`. Gestor-only, padrão idêntico a `/emprestimos/novo`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM, PostgreSQL, Zod, shadcn/ui (Button, Input, Label, Select, Dialog), sonner (toast), Jest (integração).

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `models/emprestimos.ts` | Modificar — adicionar `buscarParaDevolucao()`, estender `devolver()` com `opcoes.estadoRetorno` |
| `infra/schemas.ts` | Modificar — adicionar `devolverEmprestimoSchema` |
| `app/api/v1/emprestimos/buscar-devolucao/route.ts` | Criar — endpoint de busca para devolução |
| `app/api/v1/loans/[id]/route.ts` | Modificar — aceitar body com `estadoRetorno` |
| `app/(app)/devolucoes/page.tsx` | Criar — Server Component |
| `app/(app)/devolucoes/_components/devolucao-form.tsx` | Criar — Client Component |
| `app/(app)/_components/header.tsx` | Modificar — adicionar link "Devoluções" |
| `tests/integration/models/emprestimos.test.ts` | Modificar — novos casos para `devolver` e `buscarParaDevolucao` |
| `tests/integration/api/v1/loans/patch.test.ts` | Modificar — casos `estadoRetorno` e autorização |
| `tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts` | Criar — testes do endpoint de busca |

---

## Task 1: Issue e Branch

**Files:**
- (nenhum arquivo a editar)

- [ ] **Passo 1: Criar issue no GitHub**

```bash
gh issue create \
  --title "feat: tela de devolução (/devolucoes)" \
  --body "Implementar a tela de devolução de exemplares conforme spec em docs/superpowers/specs/2026-05-14-devolucao-design.md. Milestone 6." \
  --label "enhancement"
```

Anote o número da issue criada (ex: #59). Use-o nos próximos passos.

- [ ] **Passo 2: Criar branch**

```bash
git checkout -b feat/issue-NNN-tela-devolucao
```

Substituir `NNN` pelo número real da issue.

---

## Task 2: Estender `devolver()` com `estadoRetorno` + schema Zod

**Files:**
- Modify: `models/emprestimos.ts`
- Modify: `infra/schemas.ts`
- Modify: `tests/integration/models/emprestimos.test.ts`

### Passo 1: Escrever os testes que vão falhar

Abrir `tests/integration/models/emprestimos.test.ts`. Adicionar os dois casos abaixo **ao final do arquivo**, antes do último `}`/EOF:

```typescript
test("devolver() com estadoRetorno atualiza exemplares.estado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id); // estado padrão: "bom"
  const leitor = await criarLeitor(girotecaA.id);
  const emp = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await devolver(emp.id, ctxGestorA, { estadoRetorno: "danificado" });

  const { exemplares: exTable } = await import("db/schema");
  const [ex] = await db
    .select()
    .from(exTable)
    .where(eq(exTable.id, exemplar.id));
  expect(ex.status).toBe("disponivel");
  expect(ex.estado).toBe("danificado");
});

test("devolver() sem estadoRetorno não altera exemplares.estado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id); // estado padrão: "bom"
  const leitor = await criarLeitor(girotecaA.id);
  const emp = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await devolver(emp.id, ctxGestorA);

  const { exemplares: exTable } = await import("db/schema");
  const [ex] = await db
    .select()
    .from(exTable)
    .where(eq(exTable.id, exemplar.id));
  expect(ex.status).toBe("disponivel");
  expect(ex.estado).toBe("bom"); // inalterado
});
```

### Passo 2: Rodar e confirmar falha

```bash
npx jest tests/integration/models/emprestimos.test.ts --testNamePattern="devolver\(\) com estadoRetorno" --no-coverage 2>&1 | tail -20
```

Saída esperada: `FAIL` — o terceiro argumento de `devolver` não existe ainda.

### Passo 3: Adicionar `devolverEmprestimoSchema` em `infra/schemas.ts`

Abrir `infra/schemas.ts`. Adicionar **após `baixarExemplarSchema`**:

```typescript
export const devolverEmprestimoSchema = z.object({
  estadoRetorno: z.enum(["bom", "regular", "danificado"]).optional(),
});
```

### Passo 4: Estender `devolver()` em `models/emprestimos.ts`

Substituir a assinatura e o corpo de `devolver`:

**Antes (linhas 147–189):**
```typescript
export async function devolver(
  id: string,
  contexto: Contexto,
): Promise<Emprestimo> {
  return db.transaction(async (tx) => {
    // ...
    const now = new Date();
    await tx
      .update(exemplares)
      .set({ status: "disponivel", atualizadoEm: now })
      .where(eq(exemplares.id, emprestimo.exemplarId));
    // ...
  });
}
```

**Depois — função completa:**
```typescript
export async function devolver(
  id: string,
  contexto: Contexto,
  opcoes?: { estadoRetorno?: "bom" | "regular" | "danificado" },
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

    if (!exemplar) throw new AppError("Exemplar não encontrado.", 500);

    if (
      contexto.papel === "gestor_giroteca" &&
      exemplar.girotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }

    const now = new Date();
    await tx
      .update(exemplares)
      .set({
        status: "disponivel",
        atualizadoEm: now,
        ...(opcoes?.estadoRetorno ? { estado: opcoes.estadoRetorno } : {}),
      })
      .where(eq(exemplares.id, emprestimo.exemplarId));

    const [updated] = await tx
      .update(emprestimos)
      .set({ dataDevolucao: now })
      .where(eq(emprestimos.id, id))
      .returning();

    return updated;
  });
}
```

### Passo 5: Rodar os novos testes e confirmar que passam

```bash
npx jest tests/integration/models/emprestimos.test.ts --testNamePattern="devolver\(\)" --no-coverage 2>&1 | tail -20
```

Saída esperada: todos os 3 testes com `devolver()` no nome `PASS`.

### Passo 6: Rodar toda a suite de modelos para checar regressão

```bash
npx jest tests/integration/models/emprestimos.test.ts --no-coverage 2>&1 | tail -10
```

Saída esperada: todos passando.

### Passo 7: Commit

```bash
git add models/emprestimos.ts infra/schemas.ts tests/integration/models/emprestimos.test.ts
git commit -m "$(cat <<'EOF'
feat: estende devolver() com estadoRetorno e adiciona devolverEmprestimoSchema

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Adicionar `buscarParaDevolucao()` em `models/emprestimos.ts`

**Files:**
- Modify: `models/emprestimos.ts`
- Modify: `tests/integration/models/emprestimos.test.ts`

### Passo 1: Adicionar `buscarParaDevolucao` ao import da suite de testes

Em `tests/integration/models/emprestimos.test.ts`, alterar o import de `models/emprestimos`:

**Antes:**
```typescript
import {
  criar,
  devolver,
  listarAtrasados,
  listarEmAberto,
  renovar,
} from "models/emprestimos";
```

**Depois:**
```typescript
import {
  buscarParaDevolucao,
  criar,
  devolver,
  listarAtrasados,
  listarEmAberto,
  renovar,
} from "models/emprestimos";
```

### Passo 2: Escrever os testes que vão falhar

Adicionar ao **final** de `tests/integration/models/emprestimos.test.ts`:

```typescript
test("buscarParaDevolucao() por tombamento com empréstimo ativo retorna dados", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-001",
  });
  const leitor = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);

  const resultado = await buscarParaDevolucao("DEV-TOC-001", ctxGestorA);

  expect(resultado.ok).toBe(true);
  if (resultado.ok) {
    expect(resultado.data.exemplar.codigoTombamento).toBe("DEV-TOC-001");
    expect(resultado.data.leitor.nome).toBe("Leitor de Teste");
    expect(resultado.data.livro.titulo).toBe("Livro de Teste");
    expect(resultado.data.emprestimoId).toBeDefined();
    expect(resultado.data.dataEmprestimo).toBeDefined();
    expect(resultado.data.dataPrevistaDevolucao).toBeDefined();
  }
});

test("buscarParaDevolucao() por tombamento disponível retorna SEM_EMPRESTIMO_ABERTO", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-002",
    status: "disponivel",
  });

  const resultado = await buscarParaDevolucao("DEV-TOC-002", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "SEM_EMPRESTIMO_ABERTO" });
});

test("buscarParaDevolucao() por tombamento baixado retorna EXEMPLAR_BAIXADO", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-003",
    status: "baixado",
  });

  const resultado = await buscarParaDevolucao("DEV-TOC-003", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "EXEMPLAR_BAIXADO" });
});

test("buscarParaDevolucao() por tombamento inexistente retorna NAO_ENCONTRADO", async () => {
  const resultado = await buscarParaDevolucao("TOMBAMENTO-INEXISTENTE", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "NAO_ENCONTRADO" });
});

test("buscarParaDevolucao() por tombamento de outra giroteca não vaza existência", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-GIROTECA-A",
  });
  const leitor = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);

  const gestorBUsuario = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  });
  const ctxGestorB: Contexto = {
    usuarioId: gestorBUsuario.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };

  const resultado = await buscarParaDevolucao("DEV-TOC-GIROTECA-A", ctxGestorB);

  expect(resultado).toEqual({ ok: false, code: "NAO_ENCONTRADO" });
});

test("buscarParaDevolucao() por ISBN com 1 exemplar emprestado retorna dados", async () => {
  const livro = await criarLivro({ isbn: "9781111111111" });
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-ISBN-TOC-1",
  });
  const leitor = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);

  const resultado = await buscarParaDevolucao("9781111111111", ctxGestorA);

  expect(resultado.ok).toBe(true);
  if (resultado.ok) {
    expect(resultado.data.exemplar.codigoTombamento).toBe("DEV-ISBN-TOC-1");
  }
});

test("buscarParaDevolucao() por ISBN com >1 exemplares emprestados retorna MULTIPLOS_EMPRESTADOS", async () => {
  const livro = await criarLivro({ isbn: "9782222222222" });
  const ex1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-ISBN-TOC-2A",
  });
  const ex2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-ISBN-TOC-2B",
  });
  const leitor1 = await criarLeitor(girotecaA.id, { matricula: "DEV-MAT-2A" });
  const leitor2 = await criarLeitor(girotecaA.id, { matricula: "DEV-MAT-2B" });
  await criar({ exemplarId: ex1.id, leitorId: leitor1.id }, ctxGestorA);
  await criar({ exemplarId: ex2.id, leitorId: leitor2.id }, ctxGestorA);

  const resultado = await buscarParaDevolucao("9782222222222", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "MULTIPLOS_EMPRESTADOS" });
});
```

### Passo 3: Rodar e confirmar falha

```bash
npx jest tests/integration/models/emprestimos.test.ts --testNamePattern="buscarParaDevolucao" --no-coverage 2>&1 | tail -20
```

Saída esperada: `FAIL` — `buscarParaDevolucao is not a function`.

### Passo 4: Implementar `buscarParaDevolucao()` em `models/emprestimos.ts`

**4a.** Adicionar `livros` ao import de `db/schema` no topo do arquivo:

```typescript
import { emprestimos, exemplares, leitores, livros } from "db/schema";
```

**4b.** Adicionar os tipos exportados e a função ao **final** do arquivo (após `listarAtrasados`):

```typescript
export type EmprestimoParaDevolucao = {
  emprestimoId: string;
  exemplar: {
    id: string;
    codigoTombamento: string;
    estado: "novo" | "bom" | "regular" | "danificado";
  };
  livro: { titulo: string; autores: string; capaUrl: string | null };
  leitor: { nome: string; turma: string | null };
  dataEmprestimo: Date;
  dataPrevistaDevolucao: Date;
};

export type BuscaDevResult =
  | { ok: true; data: EmprestimoParaDevolucao }
  | {
      ok: false;
      code:
        | "NAO_ENCONTRADO"
        | "SEM_EMPRESTIMO_ABERTO"
        | "MULTIPLOS_EMPRESTADOS"
        | "EXEMPLAR_BAIXADO";
    };

const ISBN_REGEX_DEV = /^\d{10}$|^\d{13}$/;

export async function buscarParaDevolucao(
  query: string,
  contexto: Contexto,
): Promise<BuscaDevResult> {
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    throw new AppError("Admin não opera devoluções diretamente.", 400);
  }
  const girotecaId = contexto.girotecaId;
  const termo = query.trim();
  if (!termo) return { ok: false, code: "NAO_ENCONTRADO" };

  let exemplarRow: typeof exemplares.$inferSelect | undefined;

  if (ISBN_REGEX_DEV.test(termo)) {
    const [livroRow] = await db
      .select()
      .from(livros)
      .where(and(eq(livros.isbn, termo), isNull(livros.deletadoEm)));
    if (!livroRow) return { ok: false, code: "NAO_ENCONTRADO" };

    const emprestados = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.livroId, livroRow.id),
          eq(exemplares.girotecaId, girotecaId),
          eq(exemplares.status, "emprestado"),
        ),
      );

    if (emprestados.length === 0) return { ok: false, code: "SEM_EMPRESTIMO_ABERTO" };
    if (emprestados.length > 1) return { ok: false, code: "MULTIPLOS_EMPRESTADOS" };
    exemplarRow = emprestados[0];
  } else {
    const [row] = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.codigoTombamento, termo),
          eq(exemplares.girotecaId, girotecaId),
        ),
      );
    if (!row) return { ok: false, code: "NAO_ENCONTRADO" };
    if (row.status === "baixado") return { ok: false, code: "EXEMPLAR_BAIXADO" };
    if (row.status !== "emprestado") return { ok: false, code: "SEM_EMPRESTIMO_ABERTO" };
    exemplarRow = row;
  }

  const [dadosEmprestimo] = await db
    .select({
      emprestimoId: emprestimos.id,
      dataEmprestimo: emprestimos.dataEmprestimo,
      dataPrevistaDevolucao: emprestimos.dataPrevistaDevolucao,
      nomeLeitor: leitores.nome,
      turmaLeitor: leitores.turma,
      tituloLivro: livros.titulo,
      autoresLivro: livros.autores,
      capaUrlLivro: livros.capaUrl,
    })
    .from(emprestimos)
    .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
    .innerJoin(livros, eq(livros.id, exemplarRow.livroId))
    .where(
      and(
        eq(emprestimos.exemplarId, exemplarRow.id),
        isNull(emprestimos.dataDevolucao),
      ),
    )
    .limit(1);

  if (!dadosEmprestimo) return { ok: false, code: "SEM_EMPRESTIMO_ABERTO" };

  return {
    ok: true,
    data: {
      emprestimoId: dadosEmprestimo.emprestimoId,
      exemplar: {
        id: exemplarRow.id,
        codigoTombamento: exemplarRow.codigoTombamento,
        estado: exemplarRow.estado as "novo" | "bom" | "regular" | "danificado",
      },
      livro: {
        titulo: dadosEmprestimo.tituloLivro,
        autores: dadosEmprestimo.autoresLivro,
        capaUrl: dadosEmprestimo.capaUrlLivro,
      },
      leitor: {
        nome: dadosEmprestimo.nomeLeitor,
        turma: dadosEmprestimo.turmaLeitor,
      },
      dataEmprestimo: dadosEmprestimo.dataEmprestimo,
      dataPrevistaDevolucao: dadosEmprestimo.dataPrevistaDevolucao,
    },
  };
}
```

### Passo 5: Rodar os novos testes

```bash
npx jest tests/integration/models/emprestimos.test.ts --testNamePattern="buscarParaDevolucao" --no-coverage 2>&1 | tail -20
```

Saída esperada: todos os 7 testes com `buscarParaDevolucao` `PASS`.

### Passo 6: Suite completa de modelos — sem regressão

```bash
npx jest tests/integration/models/emprestimos.test.ts --no-coverage 2>&1 | tail -10
```

### Passo 7: Commit

```bash
git add models/emprestimos.ts tests/integration/models/emprestimos.test.ts
git commit -m "$(cat <<'EOF'
feat: adiciona buscarParaDevolucao() em models/emprestimos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Estender PATCH `/api/v1/loans/[id]` para aceitar `estadoRetorno`

**Files:**
- Modify: `app/api/v1/loans/[id]/route.ts`
- Modify: `tests/integration/api/v1/loans/patch.test.ts`

### Passo 1: Adicionar imports ao arquivo de testes

Abrir `tests/integration/api/v1/loans/patch.test.ts`. Adicionar ao **topo do arquivo** (após os imports existentes):

```typescript
import { db } from "db/index";
import { exemplares as exemplaresTbl } from "db/schema";
import { eq } from "drizzle-orm";
import { criarGiroteca } from "tests/factories";
```

Verificar que `criarGiroteca` já não está importado — se estiver, não duplicar.

### Passo 2: Escrever os testes que vão falhar

Adicionar ao **final** de `tests/integration/api/v1/loans/patch.test.ts`:

```typescript
test("PATCH /api/v1/loans/:id com estadoRetorno='danificado' atualiza exemplar.estado", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ estadoRetorno: "danificado" }),
    },
  );

  expect(response.status).toBe(200);

  const [exemplar] = await db
    .select()
    .from(exemplaresTbl)
    .where(eq(exemplaresTbl.id, exemplarId));
  expect(exemplar.estado).toBe("danificado");
  expect(exemplar.status).toBe("disponivel");
});

test("PATCH /api/v1/loans/:id sem estadoRetorno não altera exemplar.estado", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  // PATCH sem body (comportamento atual)
  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);

  const [exemplar] = await db
    .select()
    .from(exemplaresTbl)
    .where(eq(exemplaresTbl.id, exemplarId));
  expect(exemplar.estado).toBe("bom"); // inalterado — factory cria com "bom"
  expect(exemplar.status).toBe("disponivel");
});

test("PATCH /api/v1/loans/:id devolução em atraso retorna 200", async () => {
  // Cria empréstimo e simula atraso setando dataPrevistaDevolucao no passado
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  // Forçar atraso via banco direto
  const { emprestimos: empTable } = await import("db/schema");
  const { db: dbAtras } = await import("db/index");
  const { eq: eqAtras } = await import("drizzle-orm");
  await dbAtras
    .update(empTable)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eqAtras(empTable.id, loan.id));

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.dataDevolucao).not.toBeNull();
});

test("PATCH /api/v1/loans/:id gestor de outra giroteca retorna 403", async () => {
  // Cria empréstimo com admin na giroteca padrão do beforeEach
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  // Cria gestor de outra giroteca
  const outraGiroteca = await criarGiroteca({ codigo: `OUTRA-${Date.now()}` });
  await criarUsuario({
    email: "gestorB@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: outraGiroteca.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestorB@test.com", senha: "senha123" }),
  });
  const cookieB = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookieB } },
  );

  expect(response.status).toBe(403);
});
```

### Passo 3: Rodar e confirmar falha

```bash
npx jest tests/integration/api/v1/loans/patch.test.ts --testNamePattern="estadoRetorno|outra giroteca" --no-coverage 2>&1 | tail -20
```

Saída esperada: `FAIL` — o `estadoRetorno` ainda não é processado pela rota.

### Passo 4: Atualizar `app/api/v1/loans/[id]/route.ts`

Substituir o conteúdo completo do arquivo:

```typescript
import { AppError } from "infra/errors";
import { devolverEmprestimoSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { devolver } from "models/emprestimos";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;

    let estadoRetorno: "bom" | "regular" | "danificado" | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const rawBody = await request.json().catch(() => ({}));
      const parsed = parseBody(devolverEmprestimoSchema, rawBody);
      if (!parsed.ok) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      estadoRetorno = parsed.data.estadoRetorno;
    }

    const emprestimo = await devolver(id, contexto, { estadoRetorno });
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

### Passo 5: Rodar todos os testes do patch

```bash
npx jest tests/integration/api/v1/loans/patch.test.ts --no-coverage 2>&1 | tail -15
```

Saída esperada: todos os testes passando (incluindo os 3 originais + 3 novos).

### Passo 6: Commit

```bash
git add app/api/v1/loans/[id]/route.ts tests/integration/api/v1/loans/patch.test.ts
git commit -m "$(cat <<'EOF'
feat: PATCH /loans/:id aceita estadoRetorno opcional na devolução

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Criar `GET /api/v1/emprestimos/buscar-devolucao`

**Files:**
- Create: `app/api/v1/emprestimos/buscar-devolucao/route.ts`
- Create: `tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts`

### Passo 1: Escrever o arquivo de testes (novo)

Criar `tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts`:

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
let girotecaId: string;
let gestorId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;

  const gestor = await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  gestorId = gestor.id;

  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 200 para tombamento emprestado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-DEV-001",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId);
  await criarEmprestimo(exemplar.id, leitor.id, gestorId);

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-001",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.codigoTombamento).toBe("BUSCA-DEV-001");
  expect(body.leitor.nome).toBe("Leitor de Teste");
  expect(body.emprestimoId).toBeDefined();
  expect(body.livro.titulo).toBe("Livro de Teste");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 404 para tombamento disponível", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-DEV-002",
    status: "disponivel",
  });

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-002",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.code).toBe("SEM_EMPRESTIMO_ABERTO");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 404 para tombamento de outra giroteca", async () => {
  const outraGiroteca = await criarGiroteca({ codigo: `OUTRA-${Date.now()}` });
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, outraGiroteca.id, {
    codigoTombamento: "BUSCA-DEV-003",
    status: "emprestado",
  });
  const outraGestora = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: outraGiroteca.id,
  });
  const leitor = await criarLeitor(outraGiroteca.id);
  await criarEmprestimo(exemplar.id, leitor.id, outraGestora.id);

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-003",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(404);
  // Não retorna code (não vaza existência do tombamento em outra giroteca)
  const body = await res.json();
  expect(body.code).toBeUndefined();
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 404 para exemplar baixado", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-DEV-004",
    status: "baixado",
  });

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-004",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.code).toBe("EXEMPLAR_BAIXADO");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 409 para ISBN com >1 emprestados", async () => {
  const livro = await criarLivro({ isbn: "9783333333333" });
  const ex1 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-ISBN-1A",
    status: "emprestado",
  });
  const ex2 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-ISBN-1B",
    status: "emprestado",
  });
  const leitor1 = await criarLeitor(girotecaId, { matricula: "MAT-ISBN-1A" });
  const leitor2 = await criarLeitor(girotecaId, { matricula: "MAT-ISBN-1B" });
  await criarEmprestimo(ex1.id, leitor1.id, gestorId);
  await criarEmprestimo(ex2.id, leitor2.id, gestorId);

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=9783333333333",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("MULTIPLOS_EMPRESTADOS");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 400 para admin", async () => {
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  const cookieAdmin = loginAdmin.headers.get("set-cookie")!.split(";")[0].trim();

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=QUALQUER",
    { headers: { Cookie: cookieAdmin } },
  );

  expect(res.status).toBe(400);
});

test("GET /api/v1/emprestimos/buscar-devolucao sem auth retorna 401", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=QUALQUER",
  );
  expect(res.status).toBe(401);
});

test("GET /api/v1/emprestimos/buscar-devolucao sem parâmetro q retorna 400", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao",
    { headers: { Cookie: cookie } },
  );
  expect(res.status).toBe(400);
});
```

### Passo 2: Rodar e confirmar falha (rota não existe)

```bash
npx jest tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts --no-coverage 2>&1 | tail -10
```

Saída esperada: `FAIL` — `404` para todos (rota não existe ainda).

### Passo 3: Criar a rota

Criar diretório e arquivo `app/api/v1/emprestimos/buscar-devolucao/route.ts`:

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { buscarParaDevolucao } from "models/emprestimos";

const CODE_TO_STATUS: Record<string, number> = {
  NAO_ENCONTRADO: 404,
  SEM_EMPRESTIMO_ABERTO: 404,
  MULTIPLOS_EMPRESTADOS: 409,
  EXEMPLAR_BAIXADO: 404,
};

const CODE_TO_MESSAGE: Record<string, string> = {
  NAO_ENCONTRADO:
    "Nenhum exemplar com esse código foi encontrado nesta giroteca.",
  SEM_EMPRESTIMO_ABERTO: "Este exemplar não está emprestado no momento.",
  MULTIPLOS_EMPRESTADOS:
    "Há mais de um exemplar deste livro emprestado. Use o código de tombamento.",
  EXEMPLAR_BAIXADO: "Este exemplar foi baixado do acervo.",
};

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || !q.trim()) {
      return Response.json(
        { error: "Parâmetro 'q' é obrigatório." },
        { status: 400 },
      );
    }
    const resultado = await buscarParaDevolucao(q, contexto);
    if (!resultado.ok) {
      const status = CODE_TO_STATUS[resultado.code] ?? 400;
      const error = CODE_TO_MESSAGE[resultado.code] ?? "Erro desconhecido.";
      // NAO_ENCONTRADO não expõe o code para não vazar existência de dados de outras girotecas
      if (resultado.code === "NAO_ENCONTRADO") {
        return Response.json({ error }, { status });
      }
      return Response.json({ error, code: resultado.code }, { status });
    }
    return Response.json(resultado.data);
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

### Passo 4: Rodar os testes

```bash
npx jest tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts --no-coverage 2>&1 | tail -15
```

Saída esperada: todos os 8 testes `PASS`.

### Passo 5: Commit

```bash
git add app/api/v1/emprestimos/buscar-devolucao/route.ts tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts
git commit -m "$(cat <<'EOF'
feat: cria GET /api/v1/emprestimos/buscar-devolucao

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Criar `app/(app)/devolucoes/page.tsx` (Server Component)

**Files:**
- Create: `app/(app)/devolucoes/page.tsx`

### Passo 1: Criar o diretório e o arquivo

Criar `app/(app)/devolucoes/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { contextoFromServerComponent } from "lib/contexto";
import { DevolucaoForm } from "./_components/devolucao-form";

export const metadata = { title: "Devolução — Biblitec" };

export default async function DevolucoesPage() {
  const contexto = await contextoFromServerComponent();
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    redirect("/");
  }
  return <DevolucaoForm />;
}
```

### Passo 2: Verificar typecheck (a importação de `DevolucaoForm` vai falhar — isso é esperado)

```bash
npm run typecheck 2>&1 | grep "devolucao" | head -5
```

Saída esperada: erro sobre `_components/devolucao-form` não encontrado. Ignorar por ora — será resolvido na Task 7.

### Passo 3: Commit parcial

```bash
git add app/(app)/devolucoes/page.tsx
git commit -m "$(cat <<'EOF'
feat: cria Server Component da página de devolução

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Criar `DevolucaoForm` (Client Component)

**Files:**
- Create: `app/(app)/devolucoes/_components/devolucao-form.tsx`

### Passo 1: Criar o componente completo

Criar `app/(app)/devolucoes/_components/devolucao-form.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmprestimoParaDevolucao = {
  emprestimoId: string;
  exemplar: { id: string; codigoTombamento: string; estado: string };
  livro: { titulo: string; autores: string; capaUrl: string | null };
  leitor: { nome: string; turma: string | null };
  dataEmprestimo: string;
  dataPrevistaDevolucao: string;
};

const ERROS_BUSCA: Record<string, string> = {
  SEM_EMPRESTIMO_ABERTO: "Este exemplar não está emprestado no momento.",
  MULTIPLOS_EMPRESTADOS:
    "Há mais de um exemplar deste livro emprestado. Use o código de tombamento.",
  EXEMPLAR_BAIXADO: "Este exemplar foi baixado do acervo.",
};

const MOTIVOS_BAIXA = [
  { value: "Perdido", label: "Perdido" },
  { value: "Danificado", label: "Danificado" },
  { value: "Descartado", label: "Descartado" },
  { value: "Outro", label: "Outro" },
] as const;

function calcularDiasAtraso(dataPrevistaDevolucao: string): number {
  return Math.floor(
    (Date.now() - new Date(dataPrevistaDevolucao).getTime()) / 86_400_000,
  );
}

export function DevolucaoForm() {
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<EmprestimoParaDevolucao | null>(
    null,
  );
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [estadoRetorno, setEstadoRetorno] = useState("");

  const [confirmando, setConfirmando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  const [mostrarDialogBaixa, setMostrarDialogBaixa] = useState(false);
  const [exemplarIdParaBaixa, setExemplarIdParaBaixa] = useState<string | null>(
    null,
  );
  const [motivoBaixa, setMotivoBaixa] = useState("Danificado");
  const [baixando, setBaixando] = useState(false);
  const [erroBaixa, setErroBaixa] = useState<string | null>(null);

  const refBusca = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    refBusca.current?.focus();
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!busca.trim()) {
      setResultado(null);
      setErroBusca(null);
      return;
    }
    // Limpar imediatamente ao digitar — não esperar o debounce
    setResultado(null);
    setErroBusca(null);
    debounce.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/v1/emprestimos/buscar-devolucao?q=${encodeURIComponent(busca.trim())}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data: EmprestimoParaDevolucao = await res.json();
          setResultado(data);
        } else {
          const body = await res.json().catch(() => ({}));
          const code = body.code as string | undefined;
          setErroBusca(
            (code && ERROS_BUSCA[code]) ??
              (body.error as string | undefined) ??
              "Nenhum exemplar com esse código foi encontrado nesta giroteca.",
          );
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setErroBusca("Sem conexão com o servidor. Tente novamente.");
        }
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [busca]);

  function resetar() {
    setBusca("");
    setResultado(null);
    setErroBusca(null);
    setEstadoRetorno("");
    setConfirmando(false);
    setErroConfirmacao(null);
    setMostrarDialogBaixa(false);
    setExemplarIdParaBaixa(null);
    setMotivoBaixa("Danificado");
    setErroBaixa(null);
    refBusca.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resultado || confirmando) return;
    setConfirmando(true);
    setErroConfirmacao(null);
    try {
      const body = estadoRetorno ? { estadoRetorno } : {};
      const res = await fetch(`/api/v1/loans/${resultado.emprestimoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErroConfirmacao(
          (data.error as string | undefined) ?? "Erro ao registrar devolução.",
        );
        return;
      }
      toast.success("Devolução registrada.");
      if (estadoRetorno === "danificado") {
        setExemplarIdParaBaixa(resultado.exemplar.id);
        setMostrarDialogBaixa(true);
        // form não reseta — aguarda decisão do dialog de baixa
      } else {
        resetar();
      }
    } finally {
      setConfirmando(false);
    }
  }

  async function confirmarBaixa() {
    if (!exemplarIdParaBaixa || baixando) return;
    setBaixando(true);
    setErroBaixa(null);
    try {
      const res = await fetch(`/api/v1/exemplares/${exemplarIdParaBaixa}/baixar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoBaixa }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErroBaixa(
          (data.error as string | undefined) ?? "Erro ao baixar exemplar.",
        );
        return;
      }
      toast.success("Exemplar baixado do acervo.");
      setMostrarDialogBaixa(false);
      resetar();
    } finally {
      setBaixando(false);
    }
  }

  const diasAtraso = resultado
    ? calcularDiasAtraso(resultado.dataPrevistaDevolucao)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Devolução</h1>
          <p className="mt-1 text-sm text-gray-500">
            Busque o exemplar pelo tombamento ou ISBN para registrar a devolução
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          noValidate
        >
          {/* Campo de busca */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-busca">Código de tombamento ou ISBN</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={refBusca}
                id="campo-busca"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: T-001 ou 9788535910663"
                autoComplete="off"
              />
            </div>
            {buscando && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </p>
            )}
            {erroBusca && !buscando && (
              <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                {erroBusca}
              </p>
            )}
          </div>

          {/* Card de confirmação + select de estado */}
          {resultado && (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {/* Bloco do livro */}
                <div className="flex gap-3 p-4">
                  <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded shadow-sm">
                    {resultado.livro.capaUrl ? (
                      <Image
                        src={resultado.livro.capaUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100">
                        <BookOpen className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {resultado.livro.titulo}
                    </p>
                    <p className="truncate text-sm text-gray-600">
                      {resultado.livro.autores}
                    </p>
                    <p className="mt-1 font-mono text-xs text-gray-500">
                      {resultado.exemplar.codigoTombamento}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Bloco do leitor */}
                <div className="p-4">
                  <p className="font-semibold text-gray-900">
                    {resultado.leitor.nome}
                    {resultado.leitor.turma && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        · {resultado.leitor.turma}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Emprestado em{" "}
                    {new Date(resultado.dataEmprestimo).toLocaleDateString(
                      "pt-BR",
                    )}
                  </p>
                  {diasAtraso > 0 && (
                    <p className="mt-1 text-sm font-medium text-red-600">
                      ⚠ {diasAtraso} {diasAtraso === 1 ? "dia" : "dias"} em
                      atraso
                    </p>
                  )}
                </div>
              </div>

              {/* Select de estado */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="estado-retorno-trigger"
                  className="text-sm text-gray-600"
                >
                  Estado na devolução (opcional)
                </Label>
                <Select
                  value={estadoRetorno || undefined}
                  onValueChange={setEstadoRetorno}
                >
                  <SelectTrigger id="estado-retorno-trigger" className="w-full">
                    <SelectValue placeholder="Não informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bom">Bom</SelectItem>
                    <SelectItem value="regular">Danificado leve</SelectItem>
                    <SelectItem value="danificado">Danificado grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {erroConfirmacao && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {erroConfirmacao}
            </p>
          )}

          <Button
            type="submit"
            disabled={!resultado || confirmando}
            className="w-full bg-blue-600 py-6 text-base hover:bg-blue-700"
          >
            {confirmando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar devolução
          </Button>
        </form>
      </div>

      {/* Dialog de baixa pós-devolução "Danificado grave" */}
      <Dialog
        open={mostrarDialogBaixa}
        onOpenChange={(open) => {
          if (!open && !baixando) {
            setMostrarDialogBaixa(false);
            resetar();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deseja baixar este exemplar?</DialogTitle>
            <DialogDescription>
              O exemplar foi devolvido com estado Danificado grave. Você pode
              retirá-lo do acervo agora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo-baixa-trigger">
                Motivo da baixa{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select value={motivoBaixa} onValueChange={setMotivoBaixa}>
                <SelectTrigger id="motivo-baixa-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_BAIXA.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <span>Tem certeza? Esta ação não pode ser desfeita.</span>
            </div>
            {erroBaixa && (
              <p className="text-sm text-red-600" role="alert">
                {erroBaixa}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMostrarDialogBaixa(false);
                resetar();
              }}
              disabled={baixando}
            >
              Não, manter no acervo
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarBaixa}
              disabled={!motivoBaixa || baixando}
            >
              {baixando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### Passo 2: Typecheck

```bash
npm run typecheck 2>&1 | grep -E "error|devoluc" | head -20
```

Saída esperada: sem erros no novo arquivo.

### Passo 3: Commit

```bash
git add "app/(app)/devolucoes/_components/devolucao-form.tsx"
git commit -m "$(cat <<'EOF'
feat: cria Client Component DevolucaoForm

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Atualizar Header e Verificação Final

**Files:**
- Modify: `app/(app)/_components/header.tsx`

### Passo 1: Adicionar link "Devoluções" na nav

Em `app/(app)/_components/header.tsx`, localizar o bloco `<nav>` (linhas 16–32). Adicionar link após o de Empréstimos:

**Antes:**
```tsx
<Link
  href="/emprestimos/novo"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Empréstimos
</Link>
<Link
  href="/leitores"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Leitores
</Link>
```

**Depois:**
```tsx
<Link
  href="/emprestimos/novo"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Empréstimos
</Link>
<Link
  href="/devolucoes"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Devoluções
</Link>
<Link
  href="/leitores"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Leitores
</Link>
```

### Passo 2: Rodar lint + typecheck

```bash
npm run lint:check 2>&1 | tail -5
npm run typecheck 2>&1 | tail -5
```

Saída esperada: sem erros.

### Passo 3: Rodar suite completa de testes

```bash
npm test 2>&1 | tail -30
```

Saída esperada: todos os testes passando. Procurar especificamente por:
- `tests/integration/models/emprestimos.test.ts` — PASS
- `tests/integration/api/v1/loans/patch.test.ts` — PASS
- `tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts` — PASS

### Passo 4: Commit

```bash
git add "app/(app)/_components/header.tsx"
git commit -m "$(cat <<'EOF'
feat: adiciona link Devoluções no header

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Passo 5: Abrir PR

```bash
gh pr create \
  --title "feat: tela de devolução (/devolucoes)" \
  --body "$(cat <<'EOF'
## Problema

Não havia UI para registrar devoluções. O gestor precisava usar a API diretamente.

## Solução

- Novo endpoint `GET /api/v1/emprestimos/buscar-devolucao?q=` busca empréstimo ativo por tombamento ou ISBN
- `devolver()` estendido com `estadoRetorno?` opcional — atualiza `exemplares.estado` na mesma transação
- `PATCH /api/v1/loans/:id` passa a aceitar body com `estadoRetorno`
- Página `/devolucoes`: busca em tempo real + card de confirmação + select de estado + fluxo de baixa opcional para "Danificado grave"
- Autorização: gestor só acessa dados da própria giroteca; tombamento de outra giroteca retorna 404 sem vazar existência

Closes #NNN

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Substituir `#NNN` pelo número real da issue.

---

## Checklist de Entrega

- [ ] `npm run lint:check` — verde
- [ ] `npm run typecheck` — verde
- [ ] `npm test` — verde (incluindo novos testes de autorização)
- [ ] Fluxo completo testado no browser: busca por tombamento → card → confirmar → toast → foco volta ao campo
- [ ] Fluxo "Danificado grave": dialog aparece → Confirmar baixa → toast → form reseta
- [ ] Fluxo "Danificado grave": dialog aparece → Não, manter → form reseta, exemplar fica `disponivel`
- [ ] Busca vazia limpa o card
- [ ] Campo tem foco automático ao carregar a página
- [ ] Link "Devoluções" aparece no header
