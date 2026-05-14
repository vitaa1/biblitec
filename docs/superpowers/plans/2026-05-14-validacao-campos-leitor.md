# Validação de Campos do Formulário de Leitor — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar máscara de telefone brasileiro, validação inline por campo no submit e regras `.max()` + regex nos schemas Zod do servidor para o formulário de Leitor.

**Architecture:** Dois arquivos modificados. `infra/schemas.ts` recebe `.max()` e regex de telefone em `createLeitorSchema` e `updateLeitorSchema`. `leitor-dialog.tsx` recebe a função `formatarTelefone`, estado `erros` unificado e validação por campo no `handleSubmit`. Sem biblioteca extra.

**Tech Stack:** TypeScript · Zod · React controlled inputs · shadcn/ui Input

---

## Arquivos afetados

| Arquivo                                            | Ação                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `infra/schemas.ts`                                 | Modificar — adicionar `.max()` e regex de telefone                 |
| `app/(app)/leitores/_components/leitor-dialog.tsx` | Modificar — máscara, estado `erros` unificado, validação no submit |
| `tests/unit/infra/schemas-leitor.test.ts`          | Criar — testes unitários dos schemas Zod                           |

---

## Task 1: Atualizar schemas Zod do servidor

**Files:**

- Modify: `infra/schemas.ts`
- Create: `tests/unit/infra/schemas-leitor.test.ts`

- [ ] **Step 1: Escrever os testes que falharão**

Criar `tests/unit/infra/schemas-leitor.test.ts`:

```typescript
import { createLeitorSchema, updateLeitorSchema } from "infra/schemas";

describe("createLeitorSchema", () => {
  test("aceita payload válido com todos os campos", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana Lúcia",
      girotecaId: "00000000-0000-0000-0000-000000000001",
      tipo: "aluno",
      matricula: "MAT-001",
      turma: "5A",
      telefone: "(86) 99999-0000",
      responsavel: "Maria da Silva",
    });
    expect(result.success).toBe(true);
  });

  test("aceita telefone fixo (10 dígitos)", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-0000-0000-000000000001",
      telefone: "(86) 3333-0000",
    });
    expect(result.success).toBe(true);
  });

  test("rejeita telefone com formato inválido", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-0000-0000-000000000001",
      telefone: "86999990000",
    });
    expect(result.success).toBe(false);
  });

  test("rejeita matricula acima de 50 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-0000-0000-000000000001",
      matricula: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  test("rejeita turma acima de 100 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-0000-0000-000000000001",
      turma: "T".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  test("rejeita nome acima de 255 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "A".repeat(256),
      girotecaId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  test("rejeita responsavel acima de 255 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-0000-0000-000000000001",
      responsavel: "R".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  test("telefone opcional — aceita sem o campo", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateLeitorSchema", () => {
  test("rejeita telefone com formato inválido", () => {
    const result = updateLeitorSchema.safeParse({ telefone: "99999-0000" });
    expect(result.success).toBe(false);
  });

  test("aceita telefone null (remover)", () => {
    const result = updateLeitorSchema.safeParse({ telefone: null });
    expect(result.success).toBe(true);
  });

  test("aceita payload vazio (todos opcionais)", () => {
    const result = updateLeitorSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes — confirmar que falham**

```bash
npx jest tests/unit/infra/schemas-leitor.test.ts --no-coverage
```

Esperado: vários `FAIL` porque os schemas ainda não têm as regras.

- [ ] **Step 3: Atualizar `infra/schemas.ts`**

Substituir `createLeitorSchema` e `updateLeitorSchema`:

```typescript
const TELEFONE_REGEX = /^\(\d{2}\) \d{4,5}-\d{4}$/;

export const createLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório.").max(255),
  girotecaId: z.uuid("girotecaId deve ser um UUID válido."),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  matricula: z
    .string()
    .max(50, "Matrícula deve ter no máximo 50 caracteres.")
    .optional(),
  turma: z
    .string()
    .max(100, "Turma deve ter no máximo 100 caracteres.")
    .optional(),
  telefone: z
    .string()
    .regex(TELEFONE_REGEX, "Formato inválido. Use (XX) XXXXX-XXXX.")
    .optional(),
  responsavel: z
    .string()
    .max(255, "Responsável deve ter no máximo 255 caracteres.")
    .optional(),
});

export const updateLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório.").max(255).optional(),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  matricula: z
    .string()
    .max(50, "Matrícula deve ter no máximo 50 caracteres.")
    .optional()
    .nullable(),
  turma: z
    .string()
    .max(100, "Turma deve ter no máximo 100 caracteres.")
    .optional()
    .nullable(),
  telefone: z
    .string()
    .regex(TELEFONE_REGEX, "Formato inválido. Use (XX) XXXXX-XXXX.")
    .optional()
    .nullable(),
  responsavel: z
    .string()
    .max(255, "Responsável deve ter no máximo 255 caracteres.")
    .optional()
    .nullable(),
});
```

`TELEFONE_REGEX` declarado logo abaixo de `UUID_REGEX` no arquivo.

- [ ] **Step 4: Rodar os testes — confirmar que passam**

```bash
npx jest tests/unit/infra/schemas-leitor.test.ts --no-coverage
```

Esperado: todos `PASS`.

- [ ] **Step 5: Rodar suite completa — confirmar sem regressões**

```bash
npm test
```

Esperado: todos os suites passando.

- [ ] **Step 6: Commit**

```bash
git add infra/schemas.ts tests/unit/infra/schemas-leitor.test.ts
git commit -m "feat: adiciona validação de formato e limites nos schemas Zod de leitor"
```

---

## Task 2: Máscara e validação no cliente (`leitor-dialog.tsx`)

**Files:**

- Modify: `app/(app)/leitores/_components/leitor-dialog.tsx`

Não há testes de integração para o componente React — a cobertura do comportamento de submit é garantida pelos testes da API existentes.

- [ ] **Step 1: Adicionar `formatarTelefone` e substituir o estado `erros`**

No topo do arquivo, logo após os imports, adicionar a função de máscara:

```typescript
function formatarTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
```

Substituir o tipo de estado de erros no `LeitorForm`. Remover `erroGeral` e `erroMatricula` separados e adicionar `erros` unificado:

```typescript
type Erros = Partial<Record<keyof FormState | "geral", string>>;

// dentro de LeitorForm, trocar:
// const [erroGeral, setErroGeral] = useState<string | null>(null);
// const [erroMatricula, setErroMatricula] = useState<string | null>(null);
// por:
const [erros, setErros] = useState<Erros>({});
```

- [ ] **Step 2: Atualizar `setField` para limpar erro do campo alterado**

```typescript
function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
  setForm((f) => ({ ...f, [field]: value }));
  setErros((e) => ({ ...e, [field]: undefined, geral: undefined }));
}
```

Para o campo `telefone`, chamar `formatarTelefone` antes de `setField`:

No `<Input>` de telefone, o `onChange` passa a ser:

```tsx
onChange={(e) => setField("telefone", formatarTelefone(e.target.value))}
```

- [ ] **Step 3: Adicionar função `validar` e atualizar `handleSubmit`**

```typescript
function validar(): Erros {
  const e: Erros = {};
  if (!form.nome.trim()) e.nome = "Nome é obrigatório.";
  if (form.matricula.length > 50)
    e.matricula = "Matrícula deve ter no máximo 50 caracteres.";
  if (form.turma.length > 100)
    e.turma = "Turma deve ter no máximo 100 caracteres.";
  if (form.responsavel.length > 255)
    e.responsavel = "Responsável deve ter no máximo 255 caracteres.";
  const digitos = form.telefone.replace(/\D/g, "");
  if (digitos.length > 0 && digitos.length < 10)
    e.telefone = "Telefone incompleto. Ex: (86) 99999-0000";
  return e;
}

async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const errosValidacao = validar();
  if (Object.keys(errosValidacao).length > 0) {
    setErros(errosValidacao);
    return;
  }
  // ... resto do handleSubmit atual (sem alterações na lógica de fetch)
}
```

No bloco de resposta da API, substituir as referências a `setErroMatricula` e `setErroGeral`:

```typescript
if (body.code === "MATRICULA_DUPLICADA") {
  setErros({
    matricula: "Já existe um leitor com esta matrícula nesta giroteca.",
  });
} else {
  setErros({ geral: body.error ?? "Erro ao salvar leitor." });
}
```

- [ ] **Step 4: Atualizar o JSX — mostrar erros inline e adicionar atributos de acessibilidade**

Para cada campo, substituir o padrão atual pelo padrão de erro unificado. Estrutura a seguir para todos os campos opcionais:

```tsx
{
  /* nome */
}
<div className="space-y-1.5">
  <Label htmlFor="leitor-nome">
    Nome{" "}
    <span className="text-red-500" aria-hidden="true">
      *
    </span>
  </Label>
  <Input
    id="leitor-nome"
    value={form.nome}
    onChange={(e) => setField("nome", e.target.value)}
    placeholder="Ex: Ana Lúcia"
    maxLength={255}
    required
    autoFocus
    aria-invalid={!!erros.nome}
    aria-describedby={erros.nome ? "leitor-nome-erro" : undefined}
  />
  {erros.nome && (
    <p id="leitor-nome-erro" className="text-sm text-red-600" role="alert">
      {erros.nome}
    </p>
  )}
</div>;

{
  /* matricula */
}
<div className="space-y-1.5">
  <Label htmlFor="leitor-matricula">Matrícula</Label>
  <Input
    id="leitor-matricula"
    value={form.matricula}
    onChange={(e) => setField("matricula", e.target.value)}
    placeholder="Opcional"
    maxLength={50}
    aria-invalid={!!erros.matricula}
    aria-describedby={erros.matricula ? "leitor-matricula-erro" : undefined}
  />
  {erros.matricula && (
    <p id="leitor-matricula-erro" className="text-sm text-red-600" role="alert">
      {erros.matricula}
    </p>
  )}
</div>;

{
  /* turma */
}
<div className="space-y-1.5">
  <Label htmlFor="leitor-turma">Turma</Label>
  <Input
    id="leitor-turma"
    value={form.turma}
    onChange={(e) => setField("turma", e.target.value)}
    placeholder="Ex: 5A"
    maxLength={100}
    aria-invalid={!!erros.turma}
    aria-describedby={erros.turma ? "leitor-turma-erro" : undefined}
  />
  {erros.turma && (
    <p id="leitor-turma-erro" className="text-sm text-red-600" role="alert">
      {erros.turma}
    </p>
  )}
</div>;

{
  /* telefone */
}
<div className="space-y-1.5">
  <Label htmlFor="leitor-telefone">Telefone</Label>
  <Input
    id="leitor-telefone"
    value={form.telefone}
    onChange={(e) => setField("telefone", formatarTelefone(e.target.value))}
    placeholder="Ex: (86) 99999-0000"
    inputMode="tel"
    maxLength={15}
    aria-invalid={!!erros.telefone}
    aria-describedby={erros.telefone ? "leitor-telefone-erro" : undefined}
  />
  {erros.telefone && (
    <p id="leitor-telefone-erro" className="text-sm text-red-600" role="alert">
      {erros.telefone}
    </p>
  )}
</div>;

{
  /* responsavel */
}
<div className="space-y-1.5">
  <Label htmlFor="leitor-responsavel">Responsável</Label>
  <Input
    id="leitor-responsavel"
    value={form.responsavel}
    onChange={(e) => setField("responsavel", e.target.value)}
    placeholder="Nome do responsável (opcional)"
    maxLength={255}
    aria-invalid={!!erros.responsavel}
    aria-describedby={erros.responsavel ? "leitor-responsavel-erro" : undefined}
  />
  {erros.responsavel && (
    <p
      id="leitor-responsavel-erro"
      className="text-sm text-red-600"
      role="alert"
    >
      {erros.responsavel}
    </p>
  )}
</div>;

{
  /* erro geral */
}
{
  erros.geral && (
    <p className="text-sm text-red-600" role="alert">
      {erros.geral}
    </p>
  );
}
```

- [ ] **Step 5: Atualizar `podeConfirmar`**

```typescript
const temErros = Object.values(erros).some(Boolean);
const podeConfirmar = Boolean(form.nome.trim()) && !salvando && !temErros;
```

- [ ] **Step 6: Rodar lint + typecheck + testes**

```bash
npm run lint:check && npm run typecheck && npm test
```

Esperado: 38 suites, todos passando (o novo arquivo de testes da Task 1 já foi contado).

- [ ] **Step 7: Commit**

```bash
git add app/(app)/leitores/_components/leitor-dialog.tsx
git commit -m "feat: máscara de telefone e validação inline de campos no formulário de leitor"
```
