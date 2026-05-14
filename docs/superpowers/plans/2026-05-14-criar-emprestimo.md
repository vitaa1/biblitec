# Criar Empréstimo (`/emprestimos/novo`) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a página `/emprestimos/novo` com busca em tempo real de exemplar (tombamento/ISBN) e leitor, data de devolução editável, mensagens de erro específicas por código e toast de sucesso.

**Architecture:** Backend ganha (a) endpoint `GET /api/v1/exemplares/buscar` que retorna exemplar + livro + (se emprestado) leitor atual; (b) atualização em `criar()` para aceitar `dataPrevistaDevolucao` opcional (hoje até hoje+60) e emitir erros com `code`. Frontend é um Server Component fino que renderiza um Client Component complexo com debounce de 300ms em ambos os campos de busca, dropdown de sugestões para leitores e toast `sonner` no sucesso.

**Tech Stack:** Next.js 15 App Router · TypeScript · Drizzle ORM · Zod · shadcn/ui (Input, Button, Label) · sonner (toast) · lucide-react (ícones)

---

## Contexto crítico

- **Multi-tenancy:** Toda query em `exemplares`, `leitores`, `emprestimos` filtra por `girotecaId` quando `papel === 'gestor_giroteca'`. Em busca de exemplar, gestor só vê os da própria giroteca.
- **Admin não opera empréstimos:** O endpoint de busca retorna 400 para admin. A criação de empréstimo já valida via `criar()`.
- **`AppError` já tem `code`** opcional (`infra/errors.ts:5`). A rota de leitores já serializa `code` no JSON de erro — seguir o mesmo padrão.
- **`sonner` já está configurado:** `<Toaster />` montado em `app/layout.tsx`. Importar `{ toast }` de `"sonner"`.
- **Padrão de busca:** `leitores.buscar({ busca: q }, contexto)` já busca por nome OU matrícula via ILIKE. Reutilizar via `GET /api/v1/leitores?q=...` que já existe.
- **Padrão de testes:** Ver `tests/integration/api/v1/leitores/post.test.ts` para login + factories. Helpers em `tests/factories/index.ts`.

---

## Arquivos afetados

| Arquivo                                                      | Ação                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `infra/schemas.ts`                                           | Modificar — adicionar `dataPrevistaDevolucao` no `createEmprestimoSchema` |
| `models/emprestimos.ts`                                      | Modificar — `criar()` aceita data e emite códigos                         |
| `models/exemplares.ts`                                       | Modificar — adicionar `buscarParaEmprestimo(query, contexto)`             |
| `app/api/v1/loans/route.ts`                                  | Modificar — serializar `code` no erro                                     |
| `app/api/v1/exemplares/buscar/route.ts`                      | Criar — endpoint de busca                                                 |
| `app/(app)/emprestimos/novo/page.tsx`                        | Criar — Server Component                                                  |
| `app/(app)/emprestimos/_components/novo-emprestimo-form.tsx` | Criar — Client Component                                                  |
| `app/(app)/_components/header.tsx`                           | Modificar — adicionar link "Empréstimos"                                  |
| `tests/integration/api/v1/loans/post.test.ts`                | Modificar — cobrir data customizada e códigos                             |
| `tests/integration/api/v1/exemplares/buscar.test.ts`         | Criar — testes do endpoint                                                |

---

## Task 1: Atualizar schema Zod do empréstimo

**Files:**

- Modify: `infra/schemas.ts`

- [ ] **Step 1: Editar `createEmprestimoSchema`**

Substituir o bloco atual:

```typescript
export const createEmprestimoSchema = z.object({
  exemplarId: z.uuid("exemplarId deve ser um UUID válido."),
  leitorId: z.uuid("leitorId deve ser um UUID válido."),
  dataPrevistaDevolucao: z.coerce.date().optional(),
  observacoes: z.string().max(500).optional(),
});
```

- [ ] **Step 2: Rodar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add infra/schemas.ts
git commit -m "feat: aceita dataPrevistaDevolucao opcional no schema de empréstimo"
```

---

## Task 2: `criar()` aceita data customizada com validação

**Files:**

- Modify: `models/emprestimos.ts`
- Modify: `tests/integration/api/v1/loans/post.test.ts`

- [ ] **Step 1: Escrever os testes que falharão**

Adicionar ao final de `tests/integration/api/v1/loans/post.test.ts`:

```typescript
test("POST /api/v1/loans aceita dataPrevistaDevolucao customizada", async () => {
  const { exemplar, leitor } = await criarCenarioEmprestimo();
  const dataAlvo = new Date();
  dataAlvo.setDate(dataAlvo.getDate() + 30);
  const dataIso = dataAlvo.toISOString().slice(0, 10);

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitor.id,
      dataPrevistaDevolucao: dataIso,
    }),
  });

  expect(res.status).toBe(201);
  const body = await res.json();
  const dataPrevista = new Date(body.dataPrevistaDevolucao);
  expect(dataPrevista.toISOString().slice(0, 10)).toBe(dataIso);
});

test("POST /api/v1/loans rejeita data no passado", async () => {
  const { exemplar, leitor } = await criarCenarioEmprestimo();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitor.id,
      dataPrevistaDevolucao: ontem.toISOString().slice(0, 10),
    }),
  });

  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/Data de devolução fora do permitido/);
});

test("POST /api/v1/loans rejeita data acima de hoje+60", async () => {
  const { exemplar, leitor } = await criarCenarioEmprestimo();
  const muitoLonge = new Date();
  muitoLonge.setDate(muitoLonge.getDate() + 61);

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitor.id,
      dataPrevistaDevolucao: muitoLonge.toISOString().slice(0, 10),
    }),
  });

  expect(res.status).toBe(400);
});
```

Se a função helper `criarCenarioEmprestimo` ainda não existir no arquivo de teste, criar inline (logo após os imports):

```typescript
async function criarCenarioEmprestimo() {
  const livro = await criarLivro({
    titulo: "Dom Casmurro",
    autores: "Machado",
  });
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitor = await criarLeitor(girotecaId, { nome: "Ana Lúcia" });
  return { livro, exemplar, leitor };
}
```

(Verificar imports no topo do arquivo — adicionar `criarLivro`, `criarExemplar`, `criarLeitor` se faltarem.)

- [ ] **Step 2: Rodar testes — confirmar que falham**

```bash
npm test -- tests/integration/api/v1/loans/post.test.ts
```

Esperado: 3 testes novos FAIL (não há validação de data ainda).

- [ ] **Step 3: Atualizar `criar()` em `models/emprestimos.ts`**

Substituir a assinatura e o bloco interno do `criar()`:

```typescript
export async function criar(
  input: {
    exemplarId: string;
    leitorId: string;
    dataPrevistaDevolucao?: Date;
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
      throw new AppError(
        "Exemplar não disponível para empréstimo.",
        409,
        "EXEMPLAR_INDISPONIVEL",
      );
    }

    const [leitor] = await tx
      .select()
      .from(leitores)
      .where(eq(leitores.id, input.leitorId));

    if (!leitor) throw new AppError("Leitor não encontrado.", 404);
    if (!leitor.ativo)
      throw new AppError("Leitor inativo.", 409, "LEITOR_INATIVO");

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
        "LEITOR_LIMITE_ATINGIDO",
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
      throw new AppError(
        "Leitor possui empréstimo em atraso.",
        409,
        "LEITOR_COM_ATRASO",
      );
    }

    let dataPrevistaDevolucao: Date;
    if (input.dataPrevistaDevolucao) {
      const inicioHoje = new Date(now);
      inicioHoje.setHours(0, 0, 0, 0);
      const limiteMax = new Date(inicioHoje);
      limiteMax.setDate(limiteMax.getDate() + 60);
      if (
        input.dataPrevistaDevolucao < inicioHoje ||
        input.dataPrevistaDevolucao > limiteMax
      ) {
        throw new AppError(
          "Data de devolução fora do permitido (hoje até 60 dias).",
          400,
        );
      }
      dataPrevistaDevolucao = input.dataPrevistaDevolucao;
    } else {
      dataPrevistaDevolucao = new Date(now);
      dataPrevistaDevolucao.setDate(
        dataPrevistaDevolucao.getDate() + DIAS_PRAZO,
      );
    }

    await tx
      .update(exemplares)
      .set({ status: "emprestado", atualizadoEm: now })
      .where(eq(exemplares.id, input.exemplarId));

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
```

- [ ] **Step 4: Rodar testes — confirmar PASS**

```bash
npm test -- tests/integration/api/v1/loans/post.test.ts
```

Esperado: todos os testes do arquivo passam.

- [ ] **Step 5: Commit**

```bash
git add models/emprestimos.ts tests/integration/api/v1/loans/post.test.ts
git commit -m "feat: criar() aceita dataPrevistaDevolucao custom e emite códigos de erro"
```

---

## Task 3: Rota POST serializa `code` no erro

**Files:**

- Modify: `app/api/v1/loans/route.ts`
- Modify: `tests/integration/api/v1/loans/post.test.ts`

- [ ] **Step 1: Escrever os testes que falharão**

Adicionar a `tests/integration/api/v1/loans/post.test.ts`:

```typescript
test("POST /api/v1/loans erro de leitor inativo inclui code=LEITOR_INATIVO", async () => {
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitor = await criarLeitor(girotecaId, {
    nome: "Inativo",
    ativo: false,
  });

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ exemplarId: exemplar.id, leitorId: leitor.id }),
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("LEITOR_INATIVO");
});

test("POST /api/v1/loans erro de exemplar indisponível inclui code=EXEMPLAR_INDISPONIVEL", async () => {
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId, { nome: "L" });

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ exemplarId: exemplar.id, leitorId: leitor.id }),
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("EXEMPLAR_INDISPONIVEL");
});
```

- [ ] **Step 2: Rodar testes — FAIL**

```bash
npm test -- tests/integration/api/v1/loans/post.test.ts
```

Esperado: 2 testes novos FAIL (rota ainda não serializa `code`).

- [ ] **Step 3: Atualizar a rota**

Substituir o handler de erro nas duas funções (GET e POST) em `app/api/v1/loans/route.ts`:

```typescript
if (error instanceof AppError) {
  const resp: Record<string, string> = { error: error.message };
  if (error.code) resp.code = error.code;
  return Response.json(resp, { status: error.status_code });
}
```

- [ ] **Step 4: Rodar testes — PASS**

```bash
npm test -- tests/integration/api/v1/loans/post.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/loans/route.ts tests/integration/api/v1/loans/post.test.ts
git commit -m "feat: rota POST /loans serializa code do AppError no JSON de erro"
```

---

## Task 4: `buscarParaEmprestimo` em `models/exemplares.ts`

**Files:**

- Modify: `models/exemplares.ts`

Esta função é consumida apenas pela rota da Task 5 — os testes ficam na Task 5 (integração da rota cobre o model).

- [ ] **Step 1: Adicionar imports e função no `models/exemplares.ts`**

Verificar que os imports incluem (adicionar se faltarem):

```typescript
import { emprestimos, exemplares, leitores, livros } from "db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
```

No final do arquivo, adicionar:

```typescript
export type ExemplarBuscado = {
  exemplar: {
    id: string;
    codigoTombamento: string;
    status: "disponivel" | "emprestado" | "baixado";
    girotecaId: string;
  };
  livro: {
    titulo: string;
    autores: string;
    capaUrl: string | null;
  };
  leitorAtual?: {
    nome: string;
    turma: string | null;
    dataEmprestimo: Date;
  };
};

const ISBN_REGEX = /^\d{10}$|^\d{13}$/;

export async function buscarParaEmprestimo(
  query: string,
  contexto: Contexto,
): Promise<ExemplarBuscado | null> {
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    throw new AppError("Admin não opera empréstimos diretamente.", 400);
  }
  const girotecaId = contexto.girotecaId;
  const termo = query.trim();
  if (!termo) return null;

  let exemplarRow: typeof exemplares.$inferSelect | undefined;
  let livroRow: typeof livros.$inferSelect | undefined;

  if (ISBN_REGEX.test(termo)) {
    const isbnNormalizado = termo.replace(/-/g, "");
    [livroRow] = await db
      .select()
      .from(livros)
      .where(and(eq(livros.isbn, isbnNormalizado), isNull(livros.deletadoEm)));
    if (!livroRow) return null;

    [exemplarRow] = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.livroId, livroRow.id),
          eq(exemplares.girotecaId, girotecaId),
          eq(exemplares.status, "disponivel"),
        ),
      )
      .limit(1);
    if (!exemplarRow) return null;
  } else {
    [exemplarRow] = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.codigoTombamento, termo),
          eq(exemplares.girotecaId, girotecaId),
        ),
      );
    if (!exemplarRow) return null;

    [livroRow] = await db
      .select()
      .from(livros)
      .where(eq(livros.id, exemplarRow.livroId));
    if (!livroRow) return null;
  }

  const resultado: ExemplarBuscado = {
    exemplar: {
      id: exemplarRow.id,
      codigoTombamento: exemplarRow.codigoTombamento,
      status: exemplarRow.status as "disponivel" | "emprestado" | "baixado",
      girotecaId: exemplarRow.girotecaId,
    },
    livro: {
      titulo: livroRow.titulo,
      autores: livroRow.autores,
      capaUrl: livroRow.capaUrl,
    },
  };

  if (exemplarRow.status === "emprestado") {
    const [emprestimoAtivo] = await db
      .select({
        dataEmprestimo: emprestimos.dataEmprestimo,
        nome: leitores.nome,
        turma: leitores.turma,
      })
      .from(emprestimos)
      .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
      .where(
        and(
          eq(emprestimos.exemplarId, exemplarRow.id),
          isNull(emprestimos.dataDevolucao),
        ),
      )
      .orderBy(desc(emprestimos.dataEmprestimo))
      .limit(1);

    if (emprestimoAtivo) {
      resultado.leitorAtual = {
        nome: emprestimoAtivo.nome,
        turma: emprestimoAtivo.turma,
        dataEmprestimo: emprestimoAtivo.dataEmprestimo,
      };
    }
  }

  return resultado;
}
```

- [ ] **Step 2: Rodar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add models/exemplares.ts
git commit -m "feat: adiciona buscarParaEmprestimo em models/exemplares"
```

---

## Task 5: Rota `GET /api/v1/exemplares/buscar`

**Files:**

- Create: `app/api/v1/exemplares/buscar/route.ts`
- Create: `tests/integration/api/v1/exemplares/buscar.test.ts`

- [ ] **Step 1: Escrever os testes**

Criar `tests/integration/api/v1/exemplares/buscar.test.ts`:

```typescript
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  criarEmprestimo,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaId: string;
let gestorId: string;

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
  const gestor = await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  gestorId = gestor.id;

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0];

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0];
});

test("GET /api/v1/exemplares/buscar sem auth → 401", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-001",
  );
  expect(res.status).toBe(401);
});

test("GET /api/v1/exemplares/buscar admin → 400", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-001",
    { headers: { Cookie: adminCookie } },
  );
  expect(res.status).toBe(400);
});

test("GET /api/v1/exemplares/buscar tombamento disponível retorna dados completos", async () => {
  const livro = await criarLivro({
    titulo: "Dom Casmurro",
    autores: "Machado",
  });
  await criarExemplar(livro.id, girotecaId, { codigoTombamento: "T-001" });

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-001",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.codigoTombamento).toBe("T-001");
  expect(body.exemplar.status).toBe("disponivel");
  expect(body.livro.titulo).toBe("Dom Casmurro");
  expect(body.leitorAtual).toBeUndefined();
});

test("GET /api/v1/exemplares/buscar tombamento emprestado retorna leitorAtual", async () => {
  const livro = await criarLivro({
    titulo: "Vidas Secas",
    autores: "Graciliano",
  });
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "T-002",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId, { nome: "Ana", turma: "5A" });
  await criarEmprestimo(exemplar.id, leitor.id, gestorId);

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-002",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.status).toBe("emprestado");
  expect(body.leitorAtual.nome).toBe("Ana");
  expect(body.leitorAtual.turma).toBe("5A");
  expect(body.leitorAtual.dataEmprestimo).toBeDefined();
});

test("GET /api/v1/exemplares/buscar ISBN retorna primeiro disponível", async () => {
  const livro = await criarLivro({
    titulo: "Capitães da Areia",
    autores: "Jorge Amado",
    isbn: "9788535910664",
  });
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "T-A",
    status: "emprestado",
  });
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "T-B",
    status: "disponivel",
  });

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=9788535910664",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.codigoTombamento).toBe("T-B");
  expect(body.exemplar.status).toBe("disponivel");
});

test("GET /api/v1/exemplares/buscar tombamento de outra giroteca → 404", async () => {
  const outra = await criarGiroteca();
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  await criarExemplar(livro.id, outra.id, { codigoTombamento: "T-X" });

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-X",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(404);
});

test("GET /api/v1/exemplares/buscar sem q → 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/exemplares/buscar", {
    headers: { Cookie: gestorCookie },
  });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Criar a rota**

Criar `app/api/v1/exemplares/buscar/route.ts`:

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { buscarParaEmprestimo } from "models/exemplares";

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
    const resultado = await buscarParaEmprestimo(q, contexto);
    if (!resultado) {
      return Response.json(
        { error: "Exemplar não encontrado." },
        { status: 404 },
      );
    }
    return Response.json(resultado);
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

- [ ] **Step 3: Rodar os testes — PASS**

```bash
npm test -- tests/integration/api/v1/exemplares/buscar.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/exemplares/buscar/route.ts tests/integration/api/v1/exemplares/buscar.test.ts
git commit -m "feat: endpoint GET /api/v1/exemplares/buscar com dados enriquecidos"
```

---

## Task 6: Server Component da página `/emprestimos/novo`

**Files:**

- Create: `app/(app)/emprestimos/novo/page.tsx`

- [ ] **Step 1: Criar a página**

```typescript
import { redirect } from "next/navigation";
import { contextoFromServerComponent } from "lib/contexto";
import { NovoEmprestimoForm } from "../_components/novo-emprestimo-form";

export const metadata = { title: "Novo empréstimo — Biblitec" };

export default async function NovoEmprestimoPage() {
  const contexto = await contextoFromServerComponent();
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    redirect("/");
  }
  return <NovoEmprestimoForm />;
}
```

- [ ] **Step 2: Commit (a página ainda não roda — depende da Task 7)**

```bash
git add "app/(app)/emprestimos/novo/page.tsx"
git commit -m "feat: cria Server Component /emprestimos/novo"
```

---

## Task 7: Client Component `NovoEmprestimoForm`

**Files:**

- Create: `app/(app)/emprestimos/_components/novo-emprestimo-form.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Search, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExemplarBuscado {
  exemplar: {
    id: string;
    codigoTombamento: string;
    status: "disponivel" | "emprestado" | "baixado";
  };
  livro: { titulo: string; autores: string; capaUrl: string | null };
  leitorAtual?: { nome: string; turma: string | null; dataEmprestimo: string };
}

interface LeitorResumo {
  id: string;
  nome: string;
  matricula: string | null;
  turma: string | null;
  tipo: string;
}

const TIPO_LABEL: Record<string, string> = {
  aluno: "Aluno",
  professor: "Professor",
  funcionario: "Funcionário",
};

const ERROS_CODE: Record<string, string> = {
  EXEMPLAR_INDISPONIVEL:
    "Este exemplar foi emprestado por outro usuário. Recarregue a página.",
  LEITOR_INATIVO: "Este leitor está desativado. Fale com o administrador.",
  LEITOR_LIMITE_ATINGIDO:
    "Este leitor já tem 3 empréstimos em aberto. É necessário devolver um antes.",
  LEITOR_COM_ATRASO:
    "Este leitor tem empréstimos em atraso. Registre a devolução antes de novo empréstimo.",
};

function dataPadrao14Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function dataLimiteMax(): string {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

function dataHoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NovoEmprestimoForm() {
  const [buscaExemplar, setBuscaExemplar] = useState("");
  const [exemplar, setExemplar] = useState<ExemplarBuscado | null>(null);
  const [exemplarNaoEncontrado, setExemplarNaoEncontrado] = useState(false);
  const [buscandoExemplar, setBuscandoExemplar] = useState(false);

  const [buscaLeitor, setBuscaLeitor] = useState("");
  const [leitoresEncontrados, setLeitoresEncontrados] = useState<LeitorResumo[]>(
    [],
  );
  const [leitorSelecionado, setLeitorSelecionado] =
    useState<LeitorResumo | null>(null);
  const [buscandoLeitor, setBuscandoLeitor] = useState(false);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  const [dataPrevista, setDataPrevista] = useState(dataPadrao14Dias);
  const [observacoes, setObservacoes] = useState("");
  const [observacoesAberto, setObservacoesAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const refExemplar = useRef<HTMLInputElement>(null);
  const debounceExemplar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceLeitor = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortExemplar = useRef<AbortController | null>(null);
  const abortLeitor = useRef<AbortController | null>(null);

  useEffect(() => {
    refExemplar.current?.focus();
  }, []);

  // Busca de exemplar
  useEffect(() => {
    if (debounceExemplar.current) clearTimeout(debounceExemplar.current);
    if (!buscaExemplar.trim()) {
      setExemplar(null);
      setExemplarNaoEncontrado(false);
      return;
    }
    debounceExemplar.current = setTimeout(async () => {
      abortExemplar.current?.abort();
      const controller = new AbortController();
      abortExemplar.current = controller;
      setBuscandoExemplar(true);
      try {
        const res = await fetch(
          `/api/v1/exemplares/buscar?q=${encodeURIComponent(buscaExemplar.trim())}`,
          { signal: controller.signal },
        );
        if (res.status === 404) {
          setExemplar(null);
          setExemplarNaoEncontrado(true);
        } else if (res.ok) {
          const data: ExemplarBuscado = await res.json();
          setExemplar(data);
          setExemplarNaoEncontrado(false);
        } else {
          setExemplar(null);
          setExemplarNaoEncontrado(false);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setExemplar(null);
        }
      } finally {
        setBuscandoExemplar(false);
      }
    }, 300);
    return () => {
      if (debounceExemplar.current) clearTimeout(debounceExemplar.current);
    };
  }, [buscaExemplar]);

  // Busca de leitor
  useEffect(() => {
    if (debounceLeitor.current) clearTimeout(debounceLeitor.current);
    if (leitorSelecionado) return;
    if (!buscaLeitor.trim()) {
      setLeitoresEncontrados([]);
      return;
    }
    debounceLeitor.current = setTimeout(async () => {
      abortLeitor.current?.abort();
      const controller = new AbortController();
      abortLeitor.current = controller;
      setBuscandoLeitor(true);
      try {
        const res = await fetch(
          `/api/v1/leitores?q=${encodeURIComponent(buscaLeitor.trim())}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          const lista: LeitorResumo[] = (data.leitores ?? []).slice(0, 8);
          setLeitoresEncontrados(lista);
          setMostrarDropdown(true);
          // Auto-select se 1 único e matrícula bate exata
          const termo = buscaLeitor.trim();
          if (lista.length === 1 && lista[0].matricula === termo) {
            setLeitorSelecionado(lista[0]);
            setMostrarDropdown(false);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLeitoresEncontrados([]);
        }
      } finally {
        setBuscandoLeitor(false);
      }
    }, 300);
    return () => {
      if (debounceLeitor.current) clearTimeout(debounceLeitor.current);
    };
  }, [buscaLeitor, leitorSelecionado]);

  function selecionarLeitor(l: LeitorResumo) {
    setLeitorSelecionado(l);
    setBuscaLeitor(l.nome);
    setMostrarDropdown(false);
  }

  function limparLeitor() {
    setLeitorSelecionado(null);
    setBuscaLeitor("");
    setLeitoresEncontrados([]);
  }

  function resetar() {
    setBuscaExemplar("");
    setExemplar(null);
    setExemplarNaoEncontrado(false);
    setBuscaLeitor("");
    setLeitoresEncontrados([]);
    setLeitorSelecionado(null);
    setDataPrevista(dataPadrao14Dias());
    setObservacoes("");
    setObservacoesAberto(false);
    setErroGeral(null);
    refExemplar.current?.focus();
  }

  const podeConfirmar =
    !!exemplar &&
    exemplar.exemplar.status === "disponivel" &&
    !!leitorSelecionado &&
    !!dataPrevista &&
    !salvando;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeConfirmar || !exemplar || !leitorSelecionado) return;

    setErroGeral(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/v1/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exemplarId: exemplar.exemplar.id,
          leitorId: leitorSelecionado.id,
          dataPrevistaDevolucao: dataPrevista,
          observacoes: observacoes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        const msg =
          (body.code && ERROS_CODE[body.code]) ??
          body.error ??
          "Erro ao registrar empréstimo.";
        setErroGeral(msg);
        return;
      }
      toast.success(`Empréstimo registrado para ${leitorSelecionado.nome}.`);
      resetar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Novo empréstimo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Busque o exemplar pelo tombamento ou ISBN, depois o leitor
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          noValidate
        >
          {/* Campo 1 - Exemplar */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-exemplar">
              Código de tombamento ou ISBN{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={refExemplar}
                id="campo-exemplar"
                className="pl-9"
                value={buscaExemplar}
                onChange={(e) => setBuscaExemplar(e.target.value)}
                placeholder="Ex: T-001 ou 9788535910663"
                autoComplete="off"
              />
            </div>
            {buscandoExemplar && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </p>
            )}
            {exemplar && exemplar.exemplar.status === "disponivel" && (
              <div className="flex gap-3 rounded-md border border-green-200 bg-green-50 p-3">
                <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded shadow-sm">
                  {exemplar.livro.capaUrl ? (
                    <Image
                      src={exemplar.livro.capaUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">
                    {exemplar.livro.titulo}
                  </p>
                  <p className="truncate text-sm text-gray-600">
                    {exemplar.livro.autores}
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-500">
                    {exemplar.exemplar.codigoTombamento}
                  </p>
                </div>
              </div>
            )}
            {exemplar && exemplar.exemplar.status !== "disponivel" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {exemplar.leitorAtual ? (
                    <>
                      Este exemplar está emprestado para{" "}
                      <strong>{exemplar.leitorAtual.nome}</strong>
                      {exemplar.leitorAtual.turma
                        ? `, turma ${exemplar.leitorAtual.turma}`
                        : ""}
                      , desde{" "}
                      {new Date(
                        exemplar.leitorAtual.dataEmprestimo,
                      ).toLocaleDateString("pt-BR")}
                      .
                    </>
                  ) : (
                    `Exemplar com status ${exemplar.exemplar.status}.`
                  )}
                </span>
              </div>
            )}
            {exemplarNaoEncontrado && !buscandoExemplar && (
              <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                Nenhum exemplar encontrado para{" "}
                <code className="font-mono">{buscaExemplar}</code>.
              </p>
            )}
          </div>

          {/* Campo 2 - Leitor */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-leitor">
              Leitor (matrícula ou nome){" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="campo-leitor"
                className="pl-9"
                value={buscaLeitor}
                onChange={(e) => {
                  setBuscaLeitor(e.target.value);
                  if (leitorSelecionado) setLeitorSelecionado(null);
                }}
                placeholder="Ex: Ana Lúcia ou MAT-001"
                autoComplete="off"
              />
              {leitorSelecionado && (
                <button
                  type="button"
                  onClick={limparLeitor}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:underline"
                >
                  Trocar
                </button>
              )}
              {mostrarDropdown &&
                !leitorSelecionado &&
                leitoresEncontrados.length > 0 && (
                  <ul
                    className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
                    role="listbox"
                  >
                    {leitoresEncontrados.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => selecionarLeitor(l)}
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">
                            {l.nome}
                          </span>
                          <span className="text-xs text-gray-500">
                            {TIPO_LABEL[l.tipo] ?? l.tipo}
                            {l.turma ? ` · ${l.turma}` : ""}
                            {l.matricula ? ` · ${l.matricula}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            {buscandoLeitor && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </p>
            )}
            {leitorSelecionado && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-semibold text-gray-900">
                  {leitorSelecionado.nome}
                </p>
                <p className="text-xs text-gray-600">
                  {TIPO_LABEL[leitorSelecionado.tipo] ?? leitorSelecionado.tipo}
                  {leitorSelecionado.turma ? ` · ${leitorSelecionado.turma}` : ""}
                  {leitorSelecionado.matricula
                    ? ` · ${leitorSelecionado.matricula}`
                    : ""}
                </p>
              </div>
            )}
          </div>

          {/* Campo 3 - Data */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-data">Data prevista de devolução</Label>
            <Input
              id="campo-data"
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              min={dataHoje()}
              max={dataLimiteMax()}
            />
          </div>

          {/* Observações */}
          <details
            open={observacoesAberto}
            onToggle={(e) =>
              setObservacoesAberto((e.target as HTMLDetailsElement).open)
            }
          >
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
              Observações (opcional)
            </summary>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Notas sobre o empréstimo (até 500 caracteres)"
            />
          </details>

          {erroGeral && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {erroGeral}
            </p>
          )}

          <Button
            type="submit"
            disabled={!podeConfirmar}
            className="w-full bg-green-600 py-6 text-base hover:bg-green-700"
          >
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar empréstimo
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rodar lint + typecheck**

```bash
npm run lint:check && npm run typecheck
```

Esperado: limpo.

- [ ] **Step 3: Validação manual no navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000/emprestimos/novo` autenticado como gestor. Testar:

1. Digitar tombamento existente → vê card verde
2. Digitar tombamento inexistente → "Nenhum exemplar encontrado"
3. Digitar tombamento de exemplar emprestado → card amarelo com info do leitor atual
4. Digitar ISBN válido → primeiro disponível aparece
5. Buscar leitor por nome → dropdown aparece
6. Buscar leitor por matrícula exata → seleção automática
7. Trocar a data → aceita hoje+30, rejeita hoje-1, rejeita hoje+61
8. Confirmar empréstimo válido → toast aparece, form reseta, foco volta ao campo 1
9. Tentar confirmar com leitor inativo → mensagem específica aparece

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/emprestimos/_components/novo-emprestimo-form.tsx"
git commit -m "feat: NovoEmprestimoForm com busca em tempo real, debounce e toast de sucesso"
```

---

## Task 8: Adicionar link "Empréstimos" no header

**Files:**

- Modify: `app/(app)/_components/header.tsx`

- [ ] **Step 1: Atualizar header**

Adicionar o link "Empréstimos" apontando para `/emprestimos/novo` no `<nav>` existente, entre "Catálogo" e "Leitores":

```tsx
<Link href="/emprestimos/novo">Empréstimos</Link>
```

(Ler o arquivo antes para preservar o estilo dos outros links.)

- [ ] **Step 2: Rodar lint**

```bash
npm run lint:check
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/_components/header.tsx"
git commit -m "feat: adiciona link Empréstimos no header autenticado"
```

---

## Verificação final

- [ ] **Rodar toda a suite + lint + typecheck:**

```bash
npm run lint:check && npm run typecheck && npm test
```

Esperado: tudo verde.
