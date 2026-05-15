# Renovação de Empréstimo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a funcionalidade de renovação de empréstimo: corrigir o model, criar novo endpoint `/emprestimos/`, e corrigir a UI para nunca ocultar o botão "Renovar".

**Architecture:** TDD — testes de integração escritos antes da implementação, testando o novo endpoint `/api/v1/emprestimos/[id]/renovar` via HTTP contra servidor real. O model `renovarEmprestimo` é aprimorado com transação + SELECT FOR UPDATE, ordem de validações corrigida, e erros tipados. A UI corrige o padrão de ocultar → desabilitar o botão Renovar.

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM (PostgreSQL), shadcn/ui (Dialog, Alert), Jest (testes de integração via HTTP).

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `components/ui/alert.tsx` | Criar (via shadcn CLI) | Componente Alert para erros no dialog |
| `tests/integration/emprestimos/renovar.test.ts` | Criar | 9 cenários de integração para o novo endpoint |
| `models/emprestimos.ts` | Modificar | Renomear `renovar` → `renovarEmprestimo`, adicionar transação + SELECT FOR UPDATE, corrigir ordem de checks e codes |
| `app/api/v1/emprestimos/[id]/renovar/route.ts` | Criar | Endpoint POST que mapeia erros com `{ code, message }` |
| `app/api/v1/loans/[id]/renovar/route.ts` | Modificar | Atualizar import para `renovarEmprestimo` |
| `app/(app)/emprestimos/_components/emprestimo-linha.tsx` | Modificar | Botão Renovar sempre visível, desabilitado com tooltip quando inelegível |
| `app/(app)/emprestimos/_components/renovar-dialog.tsx` | Modificar | Título, botão, URL, Alert para erros, contador de renovações |

---

## Task 1: Instalar componente Alert do shadcn/ui

**Files:**
- Create: `components/ui/alert.tsx`

- [ ] **Step 1: Instalar o componente**

```bash
cd /home/vita1/biblitec && npx shadcn@latest add alert --yes
```

Expected: arquivo `components/ui/alert.tsx` criado.

- [ ] **Step 2: Verificar criação**

```bash
ls components/ui/alert.tsx
```

Expected: arquivo existe.

- [ ] **Step 3: Commit**

```bash
git add components/ui/alert.tsx
git commit -m "chore: adiciona componente Alert do shadcn/ui"
```

---

## Task 2: Escrever testes de integração — 9 cenários (fase vermelha)

**Files:**
- Create: `tests/integration/emprestimos/renovar.test.ts`

- [ ] **Step 1: Criar o arquivo de testes**

Criar `tests/integration/emprestimos/renovar.test.ts` com o conteúdo completo abaixo:

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

const BASE_URL = "http://localhost:3000/api/v1/emprestimos";

let cookieAdmin: string;
let girotecaId: string;
let exemplarId: string;
let leitorId: string;
let usuarioAdminId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId);
  exemplarId = exemplar.id;
  const leitor = await criarLeitor(girotecaId);
  leitorId = leitor.id;

  const adminUser = await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  usuarioAdminId = adminUser.id;

  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookieAdmin = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

function criarEmprestimoAtivo(
  override: Parameters<typeof criarEmprestimo>[3] = {},
) {
  return criarEmprestimo(exemplarId, leitorId, usuarioAdminId, override);
}

test("renova empréstimo válido: data avança 14 dias e renovacoes = 1", async () => {
  const emp = await criarEmprestimoAtivo();
  const dataOriginal = emp.dataPrevistaDevolucao;

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.renovacoes).toBe(1);

  const novaData = new Date(body.dataPrevistaDevolucao);
  const esperada = new Date(dataOriginal);
  esperada.setUTCDate(esperada.getUTCDate() + 14);
  expect(novaData.getTime()).toBe(esperada.getTime());
});

test("segunda renovação: renovacoes = 2", async () => {
  const emp = await criarEmprestimoAtivo({ renovacoes: 1 });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.renovacoes).toBe(2);
});

test("terceira renovação bloqueada: 409 LIMITE_RENOVACOES", async () => {
  const emp = await criarEmprestimoAtivo({ renovacoes: 2 });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("LIMITE_RENOVACOES");
});

test("empréstimo em atraso bloqueia renovação: 409 EM_ATRASO", async () => {
  const emp = await criarEmprestimoAtivo({
    dataPrevistaDevolucao: new Date("2000-01-01T00:00:00.000Z"),
  });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("EM_ATRASO");
});

test("empréstimo já devolvido: 409 JA_DEVOLVIDO", async () => {
  const emp = await criarEmprestimoAtivo({ dataDevolucao: new Date() });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("JA_DEVOLVIDO");
});

test("empréstimo inexistente: 404", async () => {
  const res = await fetch(
    `${BASE_URL}/00000000-0000-0000-0000-000000000000/renovar`,
    { method: "POST", headers: { Cookie: cookieAdmin } },
  );
  expect(res.status).toBe(404);
});

test("gestor de outra giroteca não pode renovar: 403", async () => {
  const emp = await criarEmprestimoAtivo();

  const outraGiroteca = await criarGiroteca({
    codigo: `OUTRA-${Date.now()}`,
    nome: "Outra Giroteca",
    escolaVinculada: "Outra Escola",
  });
  await criarUsuario({
    email: "gestorb@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: outraGiroteca.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestorb@test.com", senha: "senha123" }),
  });
  const cookieB = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieB },
  });

  expect(res.status).toBe(403);
});

test("admin NTE pode renovar empréstimo de qualquer giroteca: 200", async () => {
  const emp = await criarEmprestimoAtivo();

  // cookieAdmin é admin_nthe criado no beforeEach
  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
});

test("cálculo preserva ciclo: vence daqui 4 dias, nova data é daqui 18 dias", async () => {
  // Simula: hoje é dia 10, vence dia 14 (daqui 4 dias)
  // Após renovar, nova data deve ser dia 28 (dia 14 + 14), não dia 24 (hoje + 14)
  const agora = new Date();
  const venceDia14 = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 4),
  );

  const emp = await criarEmprestimoAtivo({ dataPrevistaDevolucao: venceDia14 });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  const novaData = new Date(body.dataPrevistaDevolucao);

  // Nova data deve ser venceDia14 + 14 dias
  const esperada = new Date(venceDia14);
  esperada.setUTCDate(esperada.getUTCDate() + 14);
  expect(novaData.getTime()).toBe(esperada.getTime());

  // Sanity: nova data NÃO é hoje + 14 dias
  const hojeMAis14 = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 14),
  );
  expect(novaData.getTime()).not.toBe(hojeMAis14.getTime());
});
```

- [ ] **Step 2: Rodar para confirmar falha (endpoint ainda não existe)**

```bash
npm test -- --testPathPattern="tests/integration/emprestimos/renovar" 2>&1 | tail -20
```

Expected: todos os 9 testes falham com erro 404 ou conexão recusada.

---

## Task 3: Melhorar `renovarEmprestimo` no model

**Files:**
- Modify: `models/emprestimos.ts`

O model atual tem função `renovar(id, contexto)`. Ela será renomeada para `renovarEmprestimo(input, contexto)` e aprimorada.

- [ ] **Step 1: Localizar o bloco `renovar` no arquivo**

A função `renovar` está nas linhas 207–256 de `models/emprestimos.ts`. Ela será substituída integralmente.

- [ ] **Step 2: Substituir a função `renovar` pela nova `renovarEmprestimo`**

Localizar o bloco:
```typescript
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

  if (!exemplar) throw new AppError("Exemplar não encontrado.", 500);

  if (
    contexto.papel === "gestor_giroteca" &&
    exemplar.girotecaId !== contexto.girotecaId
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
```

E substituir por:

```typescript
export async function renovarEmprestimo(
  input: { emprestimoId: string },
  contexto: Contexto,
): Promise<Emprestimo> {
  return db.transaction(async (tx) => {
    // SELECT FOR UPDATE previne race condition em renovações concorrentes
    const [emprestimo] = await tx
      .select()
      .from(emprestimos)
      .where(eq(emprestimos.id, input.emprestimoId))
      .for("update");

    if (!emprestimo) {
      throw new AppError("Empréstimo não encontrado.", 404, "NAO_ENCONTRADO");
    }

    if (contexto.papel === "gestor_giroteca") {
      const [exemplar] = await tx
        .select({ girotecaId: exemplares.girotecaId })
        .from(exemplares)
        .where(eq(exemplares.id, emprestimo.exemplarId));

      if (!exemplar || exemplar.girotecaId !== contexto.girotecaId) {
        throw new AppError("Não autorizado.", 403, "NAO_AUTORIZADO");
      }
    }

    if (emprestimo.dataDevolucao !== null) {
      throw new AppError("Este empréstimo já foi devolvido.", 409, "JA_DEVOLVIDO");
    }

    const now = new Date();
    const hoje = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (emprestimo.dataPrevistaDevolucao < hoje) {
      throw new AppError(
        "Empréstimos em atraso não podem ser renovados. Registre a devolução primeiro.",
        409,
        "EM_ATRASO",
      );
    }

    if (emprestimo.renovacoes >= MAX_RENOVACOES) {
      throw new AppError(
        "Este empréstimo já foi renovado 2 vezes. Registre a devolução.",
        409,
        "LIMITE_RENOVACOES",
      );
    }

    const novaData = new Date(emprestimo.dataPrevistaDevolucao);
    novaData.setUTCDate(novaData.getUTCDate() + DIAS_PRAZO);

    const [updated] = await tx
      .update(emprestimos)
      .set({
        dataPrevistaDevolucao: novaData,
        renovacoes: emprestimo.renovacoes + 1,
      })
      .where(eq(emprestimos.id, input.emprestimoId))
      .returning();

    return updated;
  });
}
```

- [ ] **Step 3: Verificar TypeScript sem erros**

```bash
npm run typecheck 2>&1 | grep -i "emprestimos"
```

Expected: sem erros em `models/emprestimos.ts`.

---

## Task 4: Criar `POST /api/v1/emprestimos/[id]/renovar`

**Files:**
- Create: `app/api/v1/emprestimos/[id]/renovar/route.ts`

- [ ] **Step 1: Criar a estrutura de diretórios**

```bash
mkdir -p /home/vita1/biblitec/app/api/v1/emprestimos/\[id\]/renovar
```

- [ ] **Step 2: Criar o arquivo da rota**

Criar `app/api/v1/emprestimos/[id]/renovar/route.ts`:

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { renovarEmprestimo } from "models/emprestimos";

type Params = Promise<{ id: string }>;

const BUSINESS_CODES = new Set(["JA_DEVOLVIDO", "EM_ATRASO", "LIMITE_RENOVACOES"]);

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const emprestimo = await renovarEmprestimo({ emprestimoId: id }, contexto);
    return Response.json(emprestimo);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code && BUSINESS_CODES.has(error.code)) {
        return Response.json(
          { code: error.code, message: error.message },
          { status: error.status_code },
        );
      }
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep -i "renovar"
```

Expected: sem erros.

---

## Task 5: Atualizar `/loans/[id]/renovar` e rodar todos os testes

**Files:**
- Modify: `app/api/v1/loans/[id]/renovar/route.ts`

- [ ] **Step 1: Atualizar o import no arquivo legado**

Substituir o conteúdo de `app/api/v1/loans/[id]/renovar/route.ts`:

```typescript
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { renovarEmprestimo } from "models/emprestimos";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const emprestimo = await renovarEmprestimo({ emprestimoId: id }, contexto);
    return Response.json(emprestimo);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar que não há mais imports de `renovar` no codebase**

```bash
grep -rn "from.*models/emprestimos.*renovar\|{ renovar }" /home/vita1/biblitec --include="*.ts" --include="*.tsx"
```

Expected: sem resultados (a função foi renomeada para `renovarEmprestimo`).

- [ ] **Step 3: Rodar todos os testes**

```bash
npm test 2>&1 | tail -30
```

Expected: todos os 9 novos testes passam, e os 6 testes existentes em `tests/integration/api/v1/loans/renovar.test.ts` também passam.

- [ ] **Step 4: Commit**

```bash
git add \
  tests/integration/emprestimos/renovar.test.ts \
  models/emprestimos.ts \
  app/api/v1/emprestimos/\[id\]/renovar/route.ts \
  app/api/v1/loans/\[id\]/renovar/route.ts
git commit -m "feat: renomeia renovar→renovarEmprestimo, adiciona transação e novo endpoint /emprestimos/:id/renovar

- SELECT FOR UPDATE previne race condition em renovações concorrentes
- Ordem de validações: NAO_ENCONTRADO → NAO_AUTORIZADO → JA_DEVOLVIDO → EM_ATRASO → LIMITE_RENOVACOES
- Endpoint /emprestimos/:id/renovar retorna { code, message } para erros 409
- 9 testes de integração cobrindo todos os cenários

Closes #63 (parcial — UI pendente)"
```

---

## Task 6: Corrigir `EmprestimoLinha` — disable vs hide

**Files:**
- Modify: `app/(app)/emprestimos/_components/emprestimo-linha.tsx`

O problema: o botão "Renovar" é ocultado quando o empréstimo não é elegível para renovação. Pela persona Maria ("cadê o botão que estava aqui ontem?"), deve ser sempre visível mas desabilitado com explicação.

- [ ] **Step 1: Adicionar import de `MAX_RENOVACOES`**

No topo do arquivo, adicionar import:

```typescript
import { MAX_RENOVACOES } from "lib/emprestimos-config";
```

- [ ] **Step 2: Remover o import de `canRenovar` (não será mais usado)**

A linha de imports de `lib/emprestimos` atual é:
```typescript
import { calcularDiasAtraso, formatarData, canRenovar } from "lib/emprestimos";
```

Mudar para:
```typescript
import { calcularDiasAtraso, formatarData } from "lib/emprestimos";
```

- [ ] **Step 3: Substituir o bloco condicional do botão Renovar**

Localizar:
```typescript
{canRenovar({
  ...emprestimo,
  dataEmprestimo: emprestimo.dataEmprestimo.toISOString(),
  dataPrevistaDevolucao: dataPrevistoStr,
  dataDevolucao: emprestimo.dataDevolucao
    ? emprestimo.dataDevolucao.toISOString()
    : null,
}) && (
  <Button size="sm" variant="outline" onClick={onRenovar}>
    Renovar
  </Button>
)}
```

Substituir por:
```typescript
<Button
  size="sm"
  variant="outline"
  disabled={atrasado || emprestimo.renovacoes >= MAX_RENOVACOES}
  title={
    atrasado
      ? "Empréstimos em atraso não podem ser renovados"
      : emprestimo.renovacoes >= MAX_RENOVACOES
        ? "Já renovado o máximo de vezes"
        : undefined
  }
  onClick={onRenovar}
>
  Renovar
</Button>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "emprestimo-linha"
```

Expected: sem erros.

---

## Task 7: Corrigir `RenovarDialog` — título, URL, Alert, contador

**Files:**
- Modify: `app/(app)/emprestimos/_components/renovar-dialog.tsx`

- [ ] **Step 1: Atualizar os imports**

Substituir o bloco de imports atual:
```typescript
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EmprestimoListagem } from "models/emprestimos";
import { calcularNovaDataPrevista, formatarData } from "lib/emprestimos";
import { DIAS_PRAZO } from "lib/emprestimos-config";
```

Por:
```typescript
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EmprestimoListagem } from "models/emprestimos";
import { calcularNovaDataPrevista, formatarData } from "lib/emprestimos";
import { DIAS_PRAZO, MAX_RENOVACOES } from "lib/emprestimos-config";
```

- [ ] **Step 2: Atualizar o corpo do componente**

Substituir o conteúdo completo do componente `RenovarDialog` (do `return (` até o fechamento):

```typescript
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar empréstimo</DialogTitle>
          <DialogDescription>
            O empréstimo de <strong>{emprestimo.leitor.nome}</strong> será
            renovado por mais {DIAS_PRAZO} dias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-md bg-gray-50 px-4 py-3 text-sm">
          <p className="text-gray-600">
            <span className="font-medium">Livro:</span>{" "}
            {emprestimo.livro.titulo}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Data atual:</span>{" "}
            {formatarData(dataAtualStr)}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Nova data:</span>{" "}
            <span className="font-semibold text-gray-900">
              {formatarData(novaData)}
            </span>
          </p>
        </div>

        <p className="text-xs text-gray-500">
          Esta será a {emprestimo.renovacoes + 1}ª renovação de {MAX_RENOVACOES}{" "}
          permitidas.
        </p>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={renovando}>
            Cancelar
          </Button>
          {!erro && (
            <Button onClick={handleRenovar} disabled={renovando}>
              {renovando ? "Renovando..." : "Renovar empréstimo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
```

- [ ] **Step 3: Atualizar a URL do fetch para o novo endpoint**

Localizar:
```typescript
const res = await fetch(`/api/v1/loans/${emprestimo.id}/renovar`, {
```

Substituir por:
```typescript
const res = await fetch(`/api/v1/emprestimos/${emprestimo.id}/renovar`, {
```

- [ ] **Step 4: Atualizar leitura do erro na resposta 409**

O novo endpoint retorna `{ code, message }` para erros de negócio. Localizar:
```typescript
setErro(body.error ?? "Não foi possível renovar. Tente novamente.");
```

Substituir por:
```typescript
setErro(body.message ?? body.error ?? "Não foi possível renovar. Tente novamente.");
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npm run typecheck 2>&1 | grep "renovar-dialog"
```

Expected: sem erros.

- [ ] **Step 6: Rodar todos os testes**

```bash
npm test 2>&1 | tail -20
```

Expected: todos passam.

- [ ] **Step 7: Commit**

```bash
git add \
  app/\(app\)/emprestimos/_components/emprestimo-linha.tsx \
  app/\(app\)/emprestimos/_components/renovar-dialog.tsx
git commit -m "fix: botão Renovar sempre visível (desabilitado com tooltip), dialog com Alert e título corretos"
```

---

## Task 8: Lint, typecheck e validação manual

- [ ] **Step 1: Lint e typecheck completo**

```bash
npm run lint:check && npm run typecheck
```

Expected: sem erros.

- [ ] **Step 2: Testes completos**

```bash
npm test 2>&1 | grep -E "PASS|FAIL|Tests:"
```

Expected: todos os arquivos de teste com PASS.

- [ ] **Step 3: Validação manual como Maria**

Com `npm run dev` rodando, abrir `http://localhost:3000/emprestimos`:

1. **Empréstimo normal**: clicar "Renovar" → dialog abre com título "Renovar empréstimo", nova data visível, texto "Esta será a 1ª renovação de 2 permitidas" → clicar "Renovar empréstimo" → dialog fecha, lista atualiza.
2. **Empréstimo com 2 renovações**: botão "Renovar" visível mas desabilitado, tooltip "Já renovado o máximo de vezes".
3. **Empréstimo em atraso**: botão "Renovar" visível mas desabilitado, tooltip "Empréstimos em atraso não podem ser renovados".
4. **Simular erro 409**: usar DevTools para interceptar a resposta e retornar `{ code: "EM_ATRASO", message: "..." }` → Alert vermelho aparece dentro do dialog, botão "Renovar empréstimo" some, fica só "Cancelar".
