# Admin User Management Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/usuarios` page for administrators to list, create, deactivate, and reset passwords of system users, with Gestalt-based visual design using mock data.

**Architecture:** Self-contained page component under `app/admin/usuarios/` with local React state (`useState`, `useMemo`). Sub-components split by responsibility (badges, dialogs, password modal). The page itself is a client component (`"use client"`) since all state lives at the top level and all data is mocked — no API calls. Middleware already protects `/admin/*` routes (only `admin_nthe` role can access).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui (`Button`, `Input`, `Label`, `Select`, `Dialog`), Jest for utility unit tests.

---

## File Map

| File                                                     | Responsibility                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `app/admin/usuarios/types.ts`                            | `Usuario`, `Papel`, `StatusUsuario` types                                                 |
| `app/admin/usuarios/mock-users.ts`                       | 7 mock users + list of available girotecas                                                |
| `app/admin/usuarios/utils.ts`                            | `gerarSenhaTemporaria()`                                                                  |
| `app/admin/usuarios/_components/PapelBadge.tsx`          | Colored badge by role (Gestalt: Similaridade)                                             |
| `app/admin/usuarios/_components/StatusBadge.tsx`         | Colored badge by status (Gestalt: Similaridade)                                           |
| `app/admin/usuarios/_components/PasswordRevealModal.tsx` | Shows temp password after create/reset (Gestalt: Figura-fundo)                            |
| `app/admin/usuarios/_components/DeactivateDialog.tsx`    | Deactivation confirmation (Gestalt: Fechamento)                                           |
| `app/admin/usuarios/_components/NewUserDialog.tsx`       | Create user form with conditional giroteca field                                          |
| `app/admin/usuarios/page.tsx`                            | Orchestrates all state, table, filters (Gestalt: Região comum, Proximidade, Continuidade) |
| `tests/unit/admin/usuarios/utils.test.ts`                | Unit tests for `gerarSenhaTemporaria`                                                     |

---

### Task 1: Types and Mock Data

**Files:**

- Create: `app/admin/usuarios/types.ts`
- Create: `app/admin/usuarios/mock-users.ts`

- [ ] **Step 1: Create types**

```typescript
// app/admin/usuarios/types.ts

export type Papel = "admin_nthe" | "gestor" | "usuario";

export type StatusUsuario = "ativo" | "inativo";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  girotecaVinculada?: string; // presente apenas para gestores
  status: StatusUsuario;
}
```

- [ ] **Step 2: Create mock data**

```typescript
// app/admin/usuarios/mock-users.ts
import type { Usuario } from "./types";

export const mockUsuarios: Usuario[] = [
  {
    id: "1",
    nome: "Ana Cristina Melo",
    email: "ana.melo@nthe.pi.gov.br",
    papel: "admin_nthe",
    status: "ativo",
  },
  {
    id: "2",
    nome: "Carlos Eduardo Lima",
    email: "carlos.lima@giroteca.pi.gov.br",
    papel: "gestor",
    girotecaVinculada: "Giroteca Escola Estadual São João",
    status: "ativo",
  },
  {
    id: "3",
    nome: "Fernanda Sousa",
    email: "fernanda.sousa@giroteca.pi.gov.br",
    papel: "gestor",
    girotecaVinculada: "Giroteca CMEI Jardim América",
    status: "ativo",
  },
  {
    id: "4",
    nome: "Roberto Alves",
    email: "roberto.alves@giroteca.pi.gov.br",
    papel: "usuario",
    status: "ativo",
  },
  {
    id: "5",
    nome: "Patrícia Nunes",
    email: "patricia.nunes@giroteca.pi.gov.br",
    papel: "usuario",
    status: "inativo",
  },
  {
    id: "6",
    nome: "Marcos Vinicius Costa",
    email: "marcos.costa@nthe.pi.gov.br",
    papel: "admin_nthe",
    status: "ativo",
  },
  {
    id: "7",
    nome: "Juliana Ferreira",
    email: "juliana.ferreira@giroteca.pi.gov.br",
    papel: "gestor",
    girotecaVinculada: "Giroteca UEB Raimundo Nonato",
    status: "inativo",
  },
];

export const girotecasDisponiveis = [
  "Giroteca Escola Estadual São João",
  "Giroteca CMEI Jardim América",
  "Giroteca UEB Raimundo Nonato",
  "Giroteca CMEI Parque Piauí",
  "Giroteca UEB Professor Moura",
];
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/usuarios/types.ts app/admin/usuarios/mock-users.ts
git commit -m "feat: adiciona tipos e dados mockados para tela de usuários admin"
```

---

### Task 2: Password Generator Utility

**Files:**

- Create: `app/admin/usuarios/utils.ts`
- Create: `tests/unit/admin/usuarios/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/admin/usuarios/utils.test.ts
import { gerarSenhaTemporaria } from "@/app/admin/usuarios/utils";

describe("gerarSenhaTemporaria", () => {
  it("gera senha com 12 caracteres", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toHaveLength(12);
  });

  it("gera senha contendo letra maiúscula", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[A-Z]/);
  });

  it("gera senha contendo letra minúscula", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[a-z]/);
  });

  it("gera senha contendo dígito", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[0-9]/);
  });

  it("gera senha contendo caractere especial", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[!@#$%^&*]/);
  });

  it("gera senhas diferentes a cada chamada", () => {
    const senhas = new Set(
      Array.from({ length: 10 }, () => gerarSenhaTemporaria()),
    );
    expect(senhas.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/admin/usuarios/utils.test.ts --testPathPattern="utils" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '@/app/admin/usuarios/utils'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/admin/usuarios/utils.ts
const CHARS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  special: "!@#$%^&*",
};

export function gerarSenhaTemporaria(): string {
  const todos = CHARS.upper + CHARS.lower + CHARS.digits + CHARS.special;
  const obrigatorios = [
    CHARS.upper[Math.floor(Math.random() * CHARS.upper.length)],
    CHARS.lower[Math.floor(Math.random() * CHARS.lower.length)],
    CHARS.digits[Math.floor(Math.random() * CHARS.digits.length)],
    CHARS.special[Math.floor(Math.random() * CHARS.special.length)],
  ];
  const resto = Array.from(
    { length: 8 },
    () => todos[Math.floor(Math.random() * todos.length)],
  );
  return [...obrigatorios, ...resto].sort(() => Math.random() - 0.5).join("");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/admin/usuarios/utils.test.ts --testPathPattern="utils" --no-coverage 2>&1 | tail -20
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/admin/usuarios/utils.ts tests/unit/admin/usuarios/utils.test.ts
git commit -m "feat: adiciona gerador de senha temporária com testes"
```

---

### Task 3: Role and Status Badges

**Files:**

- Create: `app/admin/usuarios/_components/PapelBadge.tsx`
- Create: `app/admin/usuarios/_components/StatusBadge.tsx`

- [ ] **Step 1: Create PapelBadge**

Gestalt — **Similaridade**: cor consistente por papel em toda a tabela (roxo = admin, âmbar = gestor, azul = usuário).

```tsx
// app/admin/usuarios/_components/PapelBadge.tsx
import type { Papel } from "../types";

const PAPEL_CONFIG: Record<Papel, { label: string; className: string }> = {
  admin_nthe: {
    label: "Administrador",
    className: "bg-purple-100 text-purple-800 border border-purple-200",
  },
  gestor: {
    label: "Gestor",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  usuario: {
    label: "Usuário",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
};

interface PapelBadgeProps {
  papel: Papel;
}

export function PapelBadge({ papel }: PapelBadgeProps) {
  const { label, className } = PAPEL_CONFIG[papel];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create StatusBadge**

Gestalt — **Similaridade**: verde = ativo, vermelho = inativo; consistente em todas as linhas.

```tsx
// app/admin/usuarios/_components/StatusBadge.tsx
import type { StatusUsuario } from "../types";

const STATUS_CONFIG: Record<
  StatusUsuario,
  { label: string; className: string }
> = {
  ativo: {
    label: "Ativo",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  inativo: {
    label: "Inativo",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
};

interface StatusBadgeProps {
  status: StatusUsuario;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/usuarios/_components/PapelBadge.tsx app/admin/usuarios/_components/StatusBadge.tsx
git commit -m "feat: adiciona badges de papel e status para tabela de usuários"
```

---

### Task 4: PasswordRevealModal Component

**Files:**

- Create: `app/admin/usuarios/_components/PasswordRevealModal.tsx`

- [ ] **Step 1: Create the component**

Gestalt — **Figura-fundo**: overlay escurecido isola o modal do conteúdo; **Fechamento**: borda completa delimita a caixa da senha; fonte monoespaçada destaca a senha visualmente como elemento prioritário.

```tsx
// app/admin/usuarios/_components/PasswordRevealModal.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PasswordRevealModalProps {
  open: boolean;
  nomeUsuario: string;
  senha: string;
  onClose: () => void;
}

export function PasswordRevealModal({
  open,
  nomeUsuario,
  senha,
  onClose,
}: PasswordRevealModalProps) {
  const [copiado, setCopiado] = useState(false);

  async function copiarSenha() {
    await navigator.clipboard.writeText(senha);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha temporária gerada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A senha temporária de <strong>{nomeUsuario}</strong> foi gerada.
            Repasse-a agora.
          </p>

          {/* Gestalt - Figura-fundo: caixa com fundo diferenciado destaca a senha */}
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <p className="select-all text-center font-mono text-2xl font-bold tracking-widest text-amber-900">
              {senha}
            </p>
          </div>

          {/* Gestalt - Fechamento: aviso delimitado em área própria */}
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">
              ⚠ Guarde esta senha. Ela não será exibida novamente.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={copiarSenha}
            aria-label="Copiar senha temporária para a área de transferência"
          >
            {copiado ? "Copiado!" : "Copiar senha"}
          </Button>
          <Button
            onClick={onClose}
            aria-label="Fechar modal de senha temporária"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/usuarios/_components/PasswordRevealModal.tsx
git commit -m "feat: adiciona modal de exibição de senha temporária"
```

---

### Task 5: DeactivateDialog Component

**Files:**

- Create: `app/admin/usuarios/_components/DeactivateDialog.tsx`

- [ ] **Step 1: Create the component**

Gestalt — **Figura-fundo**: overlay escurecido isola o dialog; **Fechamento**: borda completa delimita a unidade de decisão; **Similaridade**: botão destrutivo sempre vermelho.

```tsx
// app/admin/usuarios/_components/DeactivateDialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeactivateDialogProps {
  open: boolean;
  nomeUsuario: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function DeactivateDialog({
  open,
  nomeUsuario,
  onConfirmar,
  onCancelar,
}: DeactivateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar usuário</DialogTitle>
          <DialogDescription>
            Desativar <strong>{nomeUsuario}</strong>? Ele perderá acesso ao
            sistema.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancelar}
            aria-label="Cancelar desativação de usuário"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmar}
            aria-label={`Confirmar desativação de ${nomeUsuario}`}
          >
            Desativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/usuarios/_components/DeactivateDialog.tsx
git commit -m "feat: adiciona dialog de confirmação de desativação de usuário"
```

---

### Task 6: NewUserDialog Component

**Files:**

- Create: `app/admin/usuarios/_components/NewUserDialog.tsx`

- [ ] **Step 1: Create the component**

Gestalt — **Fechamento**: dialog com borda completa delimita o formulário como unidade; **Proximidade**: label + input agrupados com `space-y-1.5`; **Figura-fundo**: overlay escurecido. Campo Giroteca é condicional: só renderiza quando `papel === "gestor"`. Validação de e-mail duplicado é inline e bloqueia submit.

```tsx
// app/admin/usuarios/_components/NewUserDialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Papel, Usuario } from "../types";
import { girotecasDisponiveis } from "../mock-users";

interface NovoUsuarioForm {
  nome: string;
  email: string;
  papel: Papel | "";
  girotecaVinculada: string;
}

const FORM_VAZIO: NovoUsuarioForm = {
  nome: "",
  email: "",
  papel: "",
  girotecaVinculada: "",
};

interface NewUserDialogProps {
  open: boolean;
  emailsExistentes: string[];
  onCriar: (dados: Omit<Usuario, "id" | "status">) => void;
  onCancelar: () => void;
}

export function NewUserDialog({
  open,
  emailsExistentes,
  onCriar,
  onCancelar,
}: NewUserDialogProps) {
  const [form, setForm] = useState<NovoUsuarioForm>(FORM_VAZIO);
  const [erroEmail, setErroEmail] = useState("");

  function fechar() {
    setForm(FORM_VAZIO);
    setErroEmail("");
    onCancelar();
  }

  function validarEmail(email: string) {
    if (emailsExistentes.includes(email.toLowerCase())) {
      setErroEmail("Já existe um usuário com este e-mail");
    } else {
      setErroEmail("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.papel || erroEmail) return;

    onCriar({
      nome: form.nome,
      email: form.email.toLowerCase(),
      papel: form.papel as Papel,
      ...(form.papel === "gestor" && form.girotecaVinculada
        ? { girotecaVinculada: form.girotecaVinculada }
        : {}),
    });

    setForm(FORM_VAZIO);
    setErroEmail("");
  }

  const podeConfirmar =
    Boolean(form.nome.trim()) &&
    Boolean(form.email.trim()) &&
    Boolean(form.papel) &&
    !erroEmail &&
    (form.papel !== "gestor" || Boolean(form.girotecaVinculada));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Gestalt - Proximidade: label + input como unidade visual coesa */}
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Ana Cristina Melo"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                validarEmail(e.target.value);
              }}
              placeholder="Ex: ana.melo@nthe.pi.gov.br"
              required
              aria-describedby={erroEmail ? "email-error" : undefined}
              aria-invalid={!!erroEmail}
            />
            {erroEmail && (
              <p id="email-error" className="text-sm text-red-600" role="alert">
                {erroEmail}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="papel">Papel</Label>
            <Select
              value={form.papel}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  papel: v as Papel,
                  girotecaVinculada: "",
                }))
              }
            >
              <SelectTrigger
                id="papel"
                aria-label="Selecionar papel do usuário"
              >
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin_nthe">Administrador</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="usuario">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo condicional — só exibe quando papel = gestor */}
          {form.papel === "gestor" && (
            <div className="space-y-1.5">
              <Label htmlFor="giroteca">Giroteca vinculada</Label>
              <Select
                value={form.girotecaVinculada}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, girotecaVinculada: v }))
                }
              >
                <SelectTrigger
                  id="giroteca"
                  aria-label="Selecionar giroteca vinculada"
                >
                  <SelectValue placeholder="Selecione uma giroteca" />
                </SelectTrigger>
                <SelectContent>
                  {girotecasDisponiveis.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!podeConfirmar}
              aria-label="Confirmar criação de novo usuário"
            >
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/usuarios/_components/NewUserDialog.tsx
git commit -m "feat: adiciona dialog de criação de novo usuário com validação de e-mail"
```

---

### Task 7: Main Page — Assembly

**Files:**

- Create: `app/admin/usuarios/page.tsx`

Todo o estado vive aqui. Componentes recebem apenas o que precisam via props.

Gestalt aplicado na camada de página:

- **Região comum**: filtros agrupados em card separado acima da tabela; "Novo usuário" fixo no header
- **Proximidade**: ações por linha (Resetar senha, Desativar) agrupadas na última coluna com `gap-2`
- **Continuidade**: `divide-y divide-gray-100` guia o olhar horizontalmente linha a linha
- **Figura-fundo**: usuários inativos com `opacity-50` recuam para o fundo visualmente

- [ ] **Step 1: Create the page**

```tsx
// app/admin/usuarios/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockUsuarios } from "./mock-users";
import type { Usuario } from "./types";
import { gerarSenhaTemporaria } from "./utils";
import { DeactivateDialog } from "./_components/DeactivateDialog";
import { NewUserDialog } from "./_components/NewUserDialog";
import { PapelBadge } from "./_components/PapelBadge";
import { PasswordRevealModal } from "./_components/PasswordRevealModal";
import { StatusBadge } from "./_components/StatusBadge";

interface SenhaModal {
  open: boolean;
  nomeUsuario: string;
  senha: string;
}

interface DesativarDialog {
  open: boolean;
  usuario: Usuario | null;
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(mockUsuarios);
  const [busca, setBusca] = useState("");
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false);
  const [senhaModal, setSenhaModal] = useState<SenhaModal>({
    open: false,
    nomeUsuario: "",
    senha: "",
  });
  const [desativarDialog, setDesativarDialog] = useState<DesativarDialog>({
    open: false,
    usuario: null,
  });

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  function handleCriarUsuario(dados: Omit<Usuario, "id" | "status">) {
    const senha = gerarSenhaTemporaria();
    setUsuarios((prev) => [
      ...prev,
      { ...dados, id: String(Date.now()), status: "ativo" },
    ]);
    setNovoUsuarioOpen(false);
    setSenhaModal({ open: true, nomeUsuario: dados.nome, senha });
  }

  function handleResetarSenha(usuario: Usuario) {
    const senha = gerarSenhaTemporaria();
    setSenhaModal({ open: true, nomeUsuario: usuario.nome, senha });
  }

  function handleDesativarConfirmar() {
    if (!desativarDialog.usuario) return;
    setUsuarios((prev) =>
      prev.map((u) =>
        u.id === desativarDialog.usuario!.id ? { ...u, status: "inativo" } : u,
      ),
    );
    setDesativarDialog({ open: false, usuario: null });
  }

  const emailsExistentes = usuarios.map((u) => u.email.toLowerCase());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Gestalt - Região comum: header com título + ação global, separado do conteúdo */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie os acessos ao sistema Giroteca
            </p>
          </div>
          <Button
            onClick={() => setNovoUsuarioOpen(true)}
            aria-label="Abrir formulário para criar novo usuário"
          >
            Novo usuário
          </Button>
        </div>

        {/* Gestalt - Região comum: área de filtros delimitada, separada da tabela */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <Input
            id="busca"
            type="search"
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-sm"
            aria-label="Filtrar usuários por nome ou e-mail"
          />
        </div>

        {/* Gestalt - Fechamento: tabela com borda completa delimitando a unidade */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {/* Gestalt - Proximidade: header separado do corpo pela divisória */}
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
                  E-mail
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Papel
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Giroteca vinculada
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

            {/* Gestalt - Continuidade: divide-y guia o olhar horizontalmente */}
            <tbody className="divide-y divide-gray-100 bg-white">
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    Nenhum usuário encontrado para &ldquo;{busca}&rdquo;
                  </td>
                </tr>
              )}
              {usuariosFiltrados.map((usuario) => (
                /* Gestalt - Figura-fundo: inativo com opacidade reduzida recua para o fundo */
                <tr
                  key={usuario.id}
                  className={
                    usuario.status === "inativo" ? "opacity-50" : undefined
                  }
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {usuario.nome}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {usuario.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <PapelBadge papel={usuario.papel} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {usuario.girotecaVinculada ?? "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={usuario.status} />
                  </td>

                  {/* Gestalt - Proximidade: ações da linha agrupadas juntas, à direita */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResetarSenha(usuario)}
                        aria-label={`Resetar senha de ${usuario.nome}`}
                      >
                        Resetar senha
                      </Button>
                      {usuario.status === "ativo" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDesativarDialog({ open: true, usuario })
                          }
                          aria-label={`Desativar usuário ${usuario.nome}`}
                        >
                          Desativar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          {usuariosFiltrados.length} de {usuarios.length} usuários
        </p>
      </div>

      {/* Dialogs fora do layout principal para não herdar estilos de opacidade das linhas */}
      <NewUserDialog
        open={novoUsuarioOpen}
        emailsExistentes={emailsExistentes}
        onCriar={handleCriarUsuario}
        onCancelar={() => setNovoUsuarioOpen(false)}
      />

      <PasswordRevealModal
        open={senhaModal.open}
        nomeUsuario={senhaModal.nomeUsuario}
        senha={senhaModal.senha}
        onClose={() => setSenhaModal((s) => ({ ...s, open: false }))}
      />

      <DeactivateDialog
        open={desativarDialog.open}
        nomeUsuario={desativarDialog.usuario?.nome ?? ""}
        onConfirmar={handleDesativarConfirmar}
        onCancelar={() => setDesativarDialog({ open: false, usuario: null })}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: zero errors

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint:check 2>&1 | tail -10
```

Expected: `All matched files use Prettier code style!` and no ESLint errors

- [ ] **Step 4: Commit**

```bash
git add app/admin/usuarios/page.tsx
git commit -m "feat: adiciona página de gerenciamento de usuários admin"
```

---

### Task 8: Smoke Test (Manual)

O middleware já protege `/admin/*` exigindo papel `admin_nthe` (verificado em `middleware.ts` antes da criação do plano). Esta task valida que tudo funciona de ponta a ponta.

**Files:** nenhum arquivo a criar ou modificar.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify route protection**

1. Abra `http://localhost:3000/admin/usuarios` sem login → deve redirecionar para `/login`
2. Faça login como `gestor` → acesse `/admin/usuarios` → deve redirecionar para `/` (403)
3. Faça login como `admin_nthe` → acesse `/admin/usuarios` → tabela com 7 usuários deve aparecer

- [ ] **Step 3: Verify features manually**

Com usuário `admin_nthe` logado em `/admin/usuarios`:

| Ação                                     | Resultado esperado                                    |
| ---------------------------------------- | ----------------------------------------------------- |
| Digitar "carlos" no campo de busca       | Apenas Carlos Eduardo Lima visível                    |
| Limpar busca                             | Todos os 7 usuários visíveis                          |
| Clicar "Novo usuário"                    | Dialog abre                                           |
| Selecionar Papel = Gestor                | Campo Giroteca aparece                                |
| Selecionar Papel = Usuário               | Campo Giroteca desaparece                             |
| Digitar e-mail já existente              | Erro inline exibe, botão "Criar usuário" desabilitado |
| Confirmar criação                        | Dialog fecha, modal de senha exibe                    |
| Clicar "Copiar senha"                    | Feedback "Copiado!" por 2 segundos                    |
| Clicar "Desativar" em linha ativa        | Dialog de confirmação abre                            |
| Confirmar desativação                    | Linha fica opaca, badge Inativo, botão Desativar some |
| Clicar "Resetar senha" em qualquer linha | Modal de senha exibe nova senha                       |

- [ ] **Step 4: Run full verification suite**

```bash
npm run lint:check && npm run typecheck && npm test
```

Expected: all pass

---

## Self-Review

### Spec Coverage

| Requisito                                                                            | Task                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Tabela: Nome, E-mail, Papel, Giroteca, Status, Ações                                 | Task 7                                        |
| Badges coloridos por papel                                                           | Task 3                                        |
| Filtro por nome/e-mail em tempo real (useMemo)                                       | Task 7                                        |
| Usuários inativos com visual distinto (opacity-50 + badge vermelho)                  | Tasks 3, 7                                    |
| Dialog "Novo Usuário"                                                                | Task 6                                        |
| Campo Giroteca condicional (só gestor)                                               | Task 6                                        |
| Modal senha temporária com aviso "não exibida novamente"                             | Task 4                                        |
| Botão copiar senha                                                                   | Task 4                                        |
| Validação e-mail duplicado (erro inline, bloqueia submit)                            | Task 6                                        |
| Dialog Desativar com texto exato do spec                                             | Task 5                                        |
| Botão Resetar senha (ativos e inativos)                                              | Task 7                                        |
| ≥ 6 usuários mockados variados (7 criados, 2 inativos, 3 papéis)                     | Task 1                                        |
| Gestalt — Proximidade                                                                | Tasks 6, 7                                    |
| Gestalt — Similaridade                                                               | Task 3                                        |
| Gestalt — Continuidade                                                               | Task 7 (`divide-y`)                           |
| Gestalt — Figura-fundo                                                               | Tasks 4, 5, 6, 7                              |
| Gestalt — Fechamento                                                                 | Tasks 4, 5, 6, 7                              |
| Gestalt — Região comum                                                               | Task 7                                        |
| Responsivo ≥ 768px (`max-w-7xl`, `overflow-hidden`)                                  | Task 7                                        |
| Acessível (`aria-label`, `aria-invalid`, `role="alert"`, foco gerenciado via Dialog) | Tasks 4, 5, 6, 7                              |
| Proteção de rota `/admin/*`                                                          | Middleware já existente; verificado em Task 8 |

### Placeholder Scan

Nenhum placeholder encontrado — todos os steps contêm código completo.

### Type Consistency

- `Usuario`, `Papel`, `StatusUsuario` definidos em Task 1; usados consistentemente em Tasks 3, 5, 6, 7
- `gerarSenhaTemporaria()` definida em Task 2; chamada em Task 7 (`handleCriarUsuario`, `handleResetarSenha`)
- `mockUsuarios` e `girotecasDisponiveis` definidos em Task 1; consumidos em Tasks 6 e 7
- `Omit<Usuario, "id" | "status">` — assinatura de `NewUserDialog.onCriar` bate com o que `handleCriarUsuario` em Task 7 recebe
- `PasswordRevealModal.onClose` aceita `() => void`; chamado em Task 7 com `() => setSenhaModal((s) => ({ ...s, open: false }))` ✓
