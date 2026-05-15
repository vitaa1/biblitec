# Home Dashboard — Indicador de Situação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a home page autenticada (`/`) com dois cards de métricas (empréstimos em aberto / atrasados) e três atalhos de ação rápida.

**Architecture:** Server Component em `app/(app)/page.tsx` busca dados via `contarResumoEmprestimos(contexto)` direto no servidor, sem rota de API. `app/page.tsx` (landing pública) é deletado — o middleware já redireciona não-autenticados para `/login`.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Tailwind CSS, TypeScript estrito.

---

## File Map

| Ação      | Arquivo                                     | Responsabilidade                      |
| --------- | ------------------------------------------- | ------------------------------------- |
| Modificar | `models/emprestimos.ts`                     | Adicionar `contarResumoEmprestimos`   |
| Criar     | `tests/integration/home/resumo.test.ts`     | Testes de integração da função modelo |
| Criar     | `app/(app)/page.tsx`                        | Server Component — home autenticada   |
| Criar     | `app/(app)/_components/card-resumo.tsx`     | Card de métrica com número grande     |
| Criar     | `app/(app)/_components/atalhos-rapidos.tsx` | Três botões de atalho rápido          |
| Criar     | `app/(app)/error.tsx`                       | Error boundary do route group         |
| Deletar   | `app/page.tsx`                              | Landing pública — fica obsoleta       |

---

## Task 1: `contarResumoEmprestimos` — função modelo + testes

**Files:**

- Modify: `models/emprestimos.ts`
- Create: `tests/integration/home/resumo.test.ts`

### Contexto do domínio

- `emprestimos` não tem `giroteca_id` diretamente. O filtro por giroteca é feito via `INNER JOIN exemplares` (que tem `giroteca_id`). Veja o padrão em `listarEmAberto` e `listarAtrasados` no mesmo arquivo.
- `emAberto` = empréstimos sem `dataDevolucao`, independente de atraso.
- `atrasados` ⊆ `emAberto` = sem `dataDevolucao` E `dataPrevistaDevolucao < hoje`.
- `hoje` usa `Date.UTC(...)` para evitar bug de timezone (Teresina é UTC-3).
- `admin_nthe`: sem join, vê tudo. `gestor_giroteca`: join com `exemplares` filtrado por `girotecaId`.

- [ ] **Step 1: Escrever os testes com falha**

Crie o arquivo `tests/integration/home/resumo.test.ts` com o conteúdo abaixo. O `beforeEach` segue o padrão dos outros testes de modelo do projeto — limpa o banco e cria dados mínimos.

```typescript
import { contarResumoEmprestimos } from "models/emprestimos";
import type { Contexto } from "lib/auth";
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  criarEmprestimo,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "HA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "HB01", nome: "Giroteca B" });
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

async function criarEmprestimoNaGiroteca(
  girotecaId: string,
  usuarioId: string,
  override: Parameters<typeof criarEmprestimo>[3] = {},
) {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitor = await criarLeitor(girotecaId);
  return criarEmprestimo(exemplar.id, leitor.id, usuarioId, override);
}

test("banco vazio: emAberto=0, atrasados=0", async () => {
  const resultado = await contarResumoEmprestimos(ctxAdmin);
  expect(resultado.emAberto).toBe(0);
  expect(resultado.atrasados).toBe(0);
});

test("admin vê soma de todas as girotecas", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId);
  await criarEmprestimoNaGiroteca(girotecaB.id, ctxAdmin.usuarioId);

  const resultado = await contarResumoEmprestimos(ctxAdmin);
  expect(resultado.emAberto).toBe(2);
});

test("gestor vê apenas sua giroteca", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId);
  await criarEmprestimoNaGiroteca(girotecaB.id, ctxAdmin.usuarioId);

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(1);
});

test("empréstimo devolvido não entra em emAberto nem em atrasados", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId, {
    dataDevolucao: new Date(),
  });

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(0);
  expect(resultado.atrasados).toBe(0);
});

test("empréstimo no prazo conta em emAberto mas não em atrasados", async () => {
  const futuro = new Date(Date.UTC(2099, 0, 1));
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId, {
    dataPrevistaDevolucao: futuro,
  });

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(1);
  expect(resultado.atrasados).toBe(0);
});

test("empréstimo atrasado conta em emAberto E em atrasados", async () => {
  const passado = new Date(Date.UTC(2000, 0, 1));
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId, {
    dataPrevistaDevolucao: passado,
  });

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(1);
  expect(resultado.atrasados).toBe(1);
});

test("gestor de giroteca B não vê empréstimos da giroteca A", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId);

  const gestorB = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  });
  const ctxGestorB: Contexto = {
    usuarioId: gestorB.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };

  const resultado = await contarResumoEmprestimos(ctxGestorB);
  expect(resultado.emAberto).toBe(0);
});
```

- [ ] **Step 2: Rodar os testes para confirmar falha esperada**

```bash
npm test -- --testPathPattern="home/resumo" 2>&1 | tail -20
```

Esperado: FAIL — `contarResumoEmprestimos` não existe ainda.

- [ ] **Step 3: Implementar `contarResumoEmprestimos` em `models/emprestimos.ts`**

Adicione ao final do arquivo (após `renovarEmprestimo`), antes do fechamento. Os imports `count`, `eq`, `and`, `isNull`, `lt` já estão no topo do arquivo — apenas `count` pode precisar ser adicionado se ainda não estiver.

Verifique os imports no topo do arquivo. Se `count` não estiver na lista do `drizzle-orm`, adicione-o.

```typescript
export async function contarResumoEmprestimos(
  contexto: Contexto,
): Promise<{ emAberto: number; atrasados: number }> {
  const now = new Date();
  const hoje = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (contexto.papel === "admin_nthe") {
    const [{ emAberto }] = await db
      .select({ emAberto: count() })
      .from(emprestimos)
      .where(isNull(emprestimos.dataDevolucao));

    const [{ atrasados }] = await db
      .select({ atrasados: count() })
      .from(emprestimos)
      .where(
        and(
          isNull(emprestimos.dataDevolucao),
          lt(emprestimos.dataPrevistaDevolucao, hoje),
        ),
      );

    return { emAberto: Number(emAberto), atrasados: Number(atrasados) };
  }

  const [{ emAberto }] = await db
    .select({ emAberto: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        eq(exemplares.girotecaId, contexto.girotecaId!),
      ),
    );

  const [{ atrasados }] = await db
    .select({ atrasados: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        eq(exemplares.girotecaId, contexto.girotecaId!),
        lt(emprestimos.dataPrevistaDevolucao, hoje),
      ),
    );

  return { emAberto: Number(emAberto), atrasados: Number(atrasados) };
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npm test -- --testPathPattern="home/resumo" 2>&1 | tail -20
```

Esperado: PASS — 7 testes verdes.

- [ ] **Step 5: Rodar lint e typecheck**

```bash
npm run lint:check && npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add models/emprestimos.ts tests/integration/home/resumo.test.ts
git commit -m "feat: adiciona contarResumoEmprestimos com testes (Issue #55)"
```

---

## Task 2: UI — componentes e página home

**Files:**

- Create: `app/(app)/_components/card-resumo.tsx`
- Create: `app/(app)/_components/atalhos-rapidos.tsx`
- Create: `app/(app)/page.tsx`
- Create: `app/(app)/error.tsx`
- Delete: `app/page.tsx`

### Contexto da estrutura de rotas

O route group `(app)` tem seu próprio `layout.tsx` que renderiza o `<AppHeader>`. Qualquer `page.tsx` dentro de `(app)/` herda esse layout. `app/page.tsx` (a landing pública) mapeia para a mesma rota `/` que `app/(app)/page.tsx` — ambos não podem coexistir.

### Contexto de estilo

Siga o padrão do `header.tsx`: classes Tailwind puras, sem imports de shadcn/ui para esta página. O container padrão do projeto é `mx-auto max-w-5xl px-4 sm:px-6`.

- [ ] **Step 1: Criar `app/(app)/_components/card-resumo.tsx`**

```tsx
import Link from "next/link";

interface CardResumoProps {
  titulo: string;
  subtitulo: string;
  valor: number;
  href: string;
  destaque?: boolean;
}

export function CardResumo({
  titulo,
  subtitulo,
  valor,
  href,
  destaque = false,
}: CardResumoProps) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-6 text-center transition-colors hover:bg-gray-50 ${
        destaque ? "border-2 border-red-600" : "border border-gray-200"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {titulo}
      </p>
      <p
        className={`mt-2 text-6xl font-bold leading-none ${
          destaque ? "text-red-600" : "text-gray-900"
        }`}
      >
        {valor}
      </p>
      <p
        className={`mt-2 text-sm ${destaque ? "text-red-600" : "text-gray-400"}`}
      >
        {subtitulo}
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: Criar `app/(app)/_components/atalhos-rapidos.tsx`**

```tsx
import Link from "next/link";

const ATALHOS = [
  { label: "+ Novo empréstimo", href: "/emprestimos/novo" },
  { label: "↩ Devolução", href: "/emprestimos?aba=devolucao" },
  { label: "+ Cadastrar leitor", href: "/leitores/novo" },
] as const;

export function AtalhosRapidos() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ATALHOS.map((atalho) => (
        <Link
          key={atalho.href}
          href={atalho.href}
          className="rounded-lg border border-gray-200 px-4 py-3 text-center text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          {atalho.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Criar `app/(app)/page.tsx`**

```tsx
import { contarResumoEmprestimos } from "models/emprestimos";
import { contextoFromServerComponent } from "lib/contexto";
import { CardResumo } from "./_components/card-resumo";
import { AtalhosRapidos } from "./_components/atalhos-rapidos";

export default async function HomePage() {
  const contexto = await contextoFromServerComponent();
  const { emAberto, atrasados } = await contarResumoEmprestimos(contexto);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 grid grid-cols-2 gap-4">
        <CardResumo
          titulo="Em aberto"
          subtitulo="empréstimos ativos"
          valor={emAberto}
          href="/emprestimos"
        />
        <CardResumo
          titulo="Atrasados"
          subtitulo="empréstimos atrasados"
          valor={atrasados}
          href="/emprestimos?aba=atrasados"
          destaque={atrasados > 0}
        />
      </div>
      <AtalhosRapidos />
    </main>
  );
}
```

- [ ] **Step 4: Criar `app/(app)/error.tsx`**

Next.js requer que o `error.tsx` seja um Client Component e receba `error` e `reset` como props.

```tsx
"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-600">
          Não foi possível carregar os dados da giroteca. Tente novamente.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Deletar `app/page.tsx`**

```bash
rm app/page.tsx
```

Verifique antes que o arquivo a deletar é a landing pública (conteúdo: `<Card>` com "Biblitec" e botão "Acessar o sistema"). A nova home autenticada está em `app/(app)/page.tsx`.

- [ ] **Step 6: Rodar lint e typecheck**

```bash
npm run lint:check && npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 7: Rodar todos os testes**

```bash
npm test 2>&1 | tail -30
```

Esperado: todos os testes passam (incluindo os 7 novos de `home/resumo`).

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/page.tsx app/\(app\)/_components/card-resumo.tsx app/\(app\)/_components/atalhos-rapidos.tsx app/\(app\)/error.tsx
git rm app/page.tsx
git commit -m "feat: home page autenticada com indicador de situação (Issue #55)"
```
