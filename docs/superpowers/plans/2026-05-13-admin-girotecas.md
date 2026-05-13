# Cadastro e Gestão de Girotecas (Admin NTHE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/admin/girotecas` para o admin do NTHE listar, cadastrar e desativar girotecas, com contadores de exemplares, leitores e empréstimos em aberto por unidade.

**Architecture:** Nova função `listarComContadores()` em `models/girotecas.ts` usa subqueries SQL para retornar os contadores sem N+1. Dois endpoints REST na pasta `app/api/v1/admin/girotecas/` recebem a lógica de criação e desativação. A página é um Server Component que busca os dados diretamente do model; os dialogs são Client Components que chamam os endpoints e disparam `router.refresh()`.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (`sql` template com subqueries), Zod, shadcn/ui, Tailwind CSS, `lucide-react`.

---

## File Map

| Arquivo                                                         | Ação      | Responsabilidade                                                 |
| --------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `models/girotecas.ts`                                           | Modificar | Adicionar `listarComContadores()` e tipo `GirotecaComContadores` |
| `tests/integration/models/girotecas.test.ts`                    | Modificar | Testes para `listarComContadores()`                              |
| `infra/schemas.ts`                                              | Modificar | Adicionar `createGirotecaSchema`                                 |
| `app/api/v1/admin/girotecas/route.ts`                           | Criar     | `GET` (lista com contadores) e `POST` (criar)                    |
| `app/api/v1/admin/girotecas/[id]/desativar/route.ts`            | Criar     | `PATCH` (desativar)                                              |
| `app/admin/girotecas/_components/nova-giroteca-dialog.tsx`      | Criar     | Dialog client para criação                                       |
| `app/admin/girotecas/_components/desativar-giroteca-dialog.tsx` | Criar     | Dialog client para desativação                                   |
| `app/admin/girotecas/page.tsx`                                  | Criar     | Página server com listagem e dialogs                             |

---

### Task 1: listarComContadores() — model + testes

**Files:**

- Modify: `models/girotecas.ts`
- Modify: `tests/integration/models/girotecas.test.ts`

- [ ] **Step 1: Escrever os testes que vão falhar**

Adicionar ao final de `tests/integration/models/girotecas.test.ts`:

```typescript
// ─── listarComContadores ──────────────────────────────────────────────────────

test("listarComContadores() gestor não autorizado", async () => {
  await expect(listarComContadores(ctxGestor)).rejects.toMatchObject({
    status_code: 403,
  });
});

test("listarComContadores() admin vê contadores corretos", async () => {
  const girotecaId = ctxGestor.girotecaId!;
  const livro = await criarLivro();
  const exemplar1 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "CNT-001",
  });
  const exemplar2 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "CNT-002",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId);
  await criarEmprestimo(exemplar2.id, leitor.id, ctxGestor.usuarioId);

  const lista = await listarComContadores(ctxAdmin);
  const g = lista.find((x) => x.id === girotecaId)!;

  expect(g.totalExemplares).toBe(2);
  expect(g.totalLeitores).toBe(1);
  expect(g.totalEmprestimosAbertos).toBe(1);
});

test("listarComContadores() empréstimo devolvido não conta como aberto", async () => {
  const girotecaId = ctxGestor.girotecaId!;
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "CNT-003",
  });
  const leitor = await criarLeitor(girotecaId);
  await criarEmprestimo(exemplar.id, leitor.id, ctxGestor.usuarioId, {
    dataDevolucao: new Date(),
  });

  const lista = await listarComContadores(ctxAdmin);
  const g = lista.find((x) => x.id === girotecaId)!;

  expect(g.totalEmprestimosAbertos).toBe(0);
});
```

Atualizar o import no topo do arquivo para incluir `listarComContadores`, `criarExemplar`, `criarLeitor`, `criarEmprestimo` e `criarLivro`:

```typescript
import {
  atualizar,
  criar,
  listar,
  listarComContadores,
} from "models/girotecas";
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
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
npm test -- --testPathPattern="girotecas" 2>&1 | tail -20
```

Expected: FAIL — `listarComContadores is not a function`

- [ ] **Step 3: Implementar listarComContadores() em models/girotecas.ts**

Adicionar os imports necessários e a função. Substituir as linhas de import no topo de `models/girotecas.ts`:

```typescript
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, girotecas, leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Giroteca = typeof girotecas.$inferSelect;

export type GirotecaComContadores = Giroteca & {
  totalExemplares: number;
  totalLeitores: number;
  totalEmprestimosAbertos: number;
};
```

Adicionar a função ao final do arquivo (antes ou após as demais funções):

```typescript
export async function listarComContadores(
  contexto: Contexto,
): Promise<GirotecaComContadores[]> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }

  const rows = await db
    .select({
      id: girotecas.id,
      nome: girotecas.nome,
      codigo: girotecas.codigo,
      escolaVinculada: girotecas.escolaVinculada,
      endereco: girotecas.endereco,
      ativa: girotecas.ativa,
      criadoEm: girotecas.criadoEm,
      totalExemplares: sql<number>`(
        SELECT COUNT(*) FROM exemplares e
        WHERE e.giroteca_id = ${girotecas.id}
      )`.mapWith(Number),
      totalLeitores: sql<number>`(
        SELECT COUNT(*) FROM leitores l
        WHERE l.giroteca_id = ${girotecas.id}
        AND l.ativo = true
      )`.mapWith(Number),
      totalEmprestimosAbertos: sql<number>`(
        SELECT COUNT(*) FROM emprestimos em
        JOIN exemplares ex ON ex.id = em.exemplar_id
        WHERE ex.giroteca_id = ${girotecas.id}
        AND em.data_devolucao IS NULL
      )`.mapWith(Number),
    })
    .from(girotecas)
    .orderBy(girotecas.nome);

  return rows;
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npm test -- --testPathPattern="girotecas" 2>&1 | tail -20
```

Expected: PASS — todos os testes de girotecas passando.

- [ ] **Step 5: Commit**

```bash
git add models/girotecas.ts tests/integration/models/girotecas.test.ts
git commit -m "feat: listarComContadores retorna girotecas com contadores de exemplares, leitores e empréstimos"
```

---

### Task 2: Schema Zod e rotas GET + POST

**Files:**

- Modify: `infra/schemas.ts`
- Create: `app/api/v1/admin/girotecas/route.ts`

- [ ] **Step 1: Adicionar createGirotecaSchema em infra/schemas.ts**

Adicionar após os schemas existentes (antes da função `parseBody`):

```typescript
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
```

- [ ] **Step 2: Criar a rota GET + POST**

```typescript
// app/api/v1/admin/girotecas/route.ts
import { AppError } from "infra/errors";
import { createGirotecaSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criar, listarComContadores } from "models/girotecas";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const lista = await listarComContadores(contexto);
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

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json().catch(() => null);
    const parsed = parseBody(createGirotecaSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const giroteca = await criar(parsed.data, contexto);
    return Response.json(giroteca, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    const cause = (error as { cause?: { constraint?: string } }).cause;
    if (cause?.constraint === "girotecas_codigo_unique") {
      return Response.json(
        { error: "Já existe uma giroteca com este código." },
        { status: 409 },
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

- [ ] **Step 3: Verificar tipos**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add infra/schemas.ts app/api/v1/admin/girotecas/route.ts
git commit -m "feat: GET e POST /api/v1/admin/girotecas — lista com contadores e criação"
```

---

### Task 3: Rota PATCH /desativar

**Files:**

- Create: `app/api/v1/admin/girotecas/[id]/desativar/route.ts`

- [ ] **Step 1: Criar a rota**

```typescript
// app/api/v1/admin/girotecas/[id]/desativar/route.ts
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { atualizar } from "models/girotecas";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const giroteca = await atualizar(id, { ativa: false }, contexto);
    return Response.json(giroteca);
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

- [ ] **Step 2: Verificar tipos**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/api/v1/admin/girotecas/[id]/desativar/route.ts"
git commit -m "feat: PATCH /api/v1/admin/girotecas/[id]/desativar — desativa giroteca"
```

---

### Task 4: Dialog de criação de giroteca

**Files:**

- Create: `app/admin/girotecas/_components/nova-giroteca-dialog.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// app/admin/girotecas/_components/nova-giroteca-dialog.tsx
"use client";

import { useState } from "react";
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

interface FormState {
  codigo: string;
  nome: string;
  escolaVinculada: string;
  endereco: string;
}

const FORM_VAZIO: FormState = {
  codigo: "",
  nome: "",
  escolaVinculada: "",
  endereco: "",
};

export function NovaGirotecaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setOpen(false);
    setForm(FORM_VAZIO);
    setErro(null);
  }

  function setField(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "codigo") setErro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.codigo.trim() ||
      !form.nome.trim() ||
      !form.escolaVinculada.trim()
    )
      return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/v1/admin/girotecas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: form.codigo.trim(),
          nome: form.nome.trim(),
          escolaVinculada: form.escolaVinculada.trim(),
          endereco: form.endereco.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao criar giroteca.");
        return;
      }
      router.refresh();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  const podeConfirmar =
    Boolean(form.codigo.trim()) &&
    Boolean(form.nome.trim()) &&
    Boolean(form.escolaVinculada.trim()) &&
    !salvando;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Nova giroteca
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova giroteca</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="giroteca-codigo">
                Código{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="giroteca-codigo"
                value={form.codigo}
                onChange={(e) => setField("codigo", e.target.value)}
                placeholder="Ex: ESC001"
                required
                autoFocus
                aria-invalid={!!erro}
                aria-describedby={erro ? "giroteca-erro" : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="giroteca-nome">
                Nome{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="giroteca-nome"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex: Giroteca Escola Municipal Norte"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="giroteca-escola">
                Escola vinculada{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="giroteca-escola"
                value={form.escolaVinculada}
                onChange={(e) => setField("escolaVinculada", e.target.value)}
                placeholder="Ex: Escola Municipal Norte"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="giroteca-endereco">Endereço</Label>
              <Input
                id="giroteca-endereco"
                value={form.endereco}
                onChange={(e) => setField("endereco", e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {erro && (
              <p
                id="giroteca-erro"
                className="text-sm text-red-600"
                role="alert"
              >
                {erro}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!podeConfirmar}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar giroteca
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/girotecas/_components/nova-giroteca-dialog.tsx"
git commit -m "feat: NovaGirotecaDialog com campos código, nome, escola e endereço"
```

---

### Task 5: Dialog de desativação

**Files:**

- Create: `app/admin/girotecas/_components/desativar-giroteca-dialog.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// app/admin/girotecas/_components/desativar-giroteca-dialog.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  girotecaId: string;
  nomeGiroteca: string;
}

export function DesativarGirotecaDialog({ girotecaId, nomeGiroteca }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setOpen(false);
    setErro(null);
  }

  async function confirmar() {
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(
        `/api/v1/admin/girotecas/${girotecaId}/desativar`,
        { method: "PATCH" },
      );
      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao desativar giroteca.");
        return;
      }
      router.refresh();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        aria-label={`Desativar giroteca ${nomeGiroteca}`}
      >
        Desativar
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar giroteca</DialogTitle>
            <DialogDescription>
              Desativar <strong>{nomeGiroteca}</strong>? Novos empréstimos serão
              bloqueados.
            </DialogDescription>
          </DialogHeader>

          {erro && (
            <p className="text-sm text-red-600" role="alert">
              {erro}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmar}
              disabled={salvando}
              aria-label={`Confirmar desativação de ${nomeGiroteca}`}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/girotecas/_components/desativar-giroteca-dialog.tsx"
git commit -m "feat: DesativarGirotecaDialog com confirmação e feedback de erro"
```

---

### Task 6: Página /admin/girotecas

**Files:**

- Create: `app/admin/girotecas/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
// app/admin/girotecas/page.tsx
import { contextoFromServerComponent } from "lib/contexto";
import { listarComContadores } from "models/girotecas";
import { DesativarGirotecaDialog } from "./_components/desativar-giroteca-dialog";
import { NovaGirotecaDialog } from "./_components/nova-giroteca-dialog";

export default async function AdminGirotecasPage() {
  const contexto = await contextoFromServerComponent();
  const lista = await listarComContadores(contexto);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Gestalt — Região comum: header separado do conteúdo */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Girotecas</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie as unidades do sistema
            </p>
          </div>
          <NovaGirotecaDialog />
        </div>

        {/* Gestalt — Fechamento: tabela delimitada por borda */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Nome
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Código
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Escola
                </th>
                {/* Gestalt — Proximidade: os 3 contadores agrupados juntos */}
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Exemplares
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Leitores
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Em aberto
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Ações
                </th>
              </tr>
            </thead>

            {/* Gestalt — Continuidade: divide-y guia o olhar horizontalmente */}
            <tbody className="divide-y divide-gray-100 bg-white">
              {lista.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    Nenhuma giroteca cadastrada.
                  </td>
                </tr>
              )}
              {lista.map((g) => (
                /* Gestalt — Figura-fundo: inativa com opacidade reduzida recua para o fundo */
                <tr key={g.id} className={!g.ativa ? "opacity-50" : undefined}>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {g.nome}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-mono text-sm text-gray-500">
                      {g.codigo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {g.escolaVinculada}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm text-gray-700">
                      {g.totalExemplares}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm text-gray-700">
                      {g.totalLeitores}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {g.totalEmprestimosAbertos > 0 ? (
                      <span className="text-sm font-medium text-amber-600">
                        {g.totalEmprestimosAbertos}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        g.ativa
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-gray-100 text-gray-500 ring-gray-500/20"
                      }`}
                    >
                      {g.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  {/* Gestalt — Proximidade: ações da linha agrupadas à direita */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {g.ativa && (
                      <DesativarGirotecaDialog
                        girotecaId={g.id}
                        nomeGiroteca={g.nome}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          {lista.length} giroteca{lista.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint e tipos**

```bash
npm run lint:check && npm run typecheck
```

Expected: sem erros.

- [ ] **Step 3: Testar manualmente**

```bash
npm run dev
```

Verificar com `admin@nthe.teresina.pi.gov.br` / `biblitec@dev`:

- Acessar `/admin/girotecas` — listagem aparece com as girotecas do seed
- Contadores corretos (seed criou 44 exemplares, 0 leitores, 0 empréstimos)
- "Nova giroteca" abre dialog; criar uma nova — aparece na lista após fechar
- Tentar criar com código duplicado — erro "Já existe uma giroteca com este código."
- Botão "Desativar" aparece apenas em girotecas ativas; clicar e confirmar — giroteca fica com opacidade reduzida e badge "Inativa"
- Verificar que gestor (`gestor.esc001@teresina.pi.gov.br`) não consegue acessar `/admin/girotecas` (redireciona para `/`)

- [ ] **Step 4: Rodar suite completa de testes**

```bash
npm test 2>&1 | tail -10
```

Expected: todos os testes passando (nenhuma regressão).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/girotecas/page.tsx"
git commit -m "feat: página /admin/girotecas com listagem, cadastro e desativação de girotecas"
```
