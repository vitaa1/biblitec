# Header com Identidade do Usuário e Logout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um header fixo em todas as páginas autenticadas exibindo o nome do usuário logado e um botão "Sair" que encerra a sessão.

**Architecture:** Uma Server Action `logoutAction` limpa o cookie `biblitec_session` e redireciona para `/login`. Um Server Component `AppHeader` busca o perfil do usuário via `buscarProprioPerfil` e renderiza o header com um `<form>` apontando para a action. O layout do grupo `(app)` é atualizado para incluir o header acima de todo conteúdo.

**Tech Stack:** Next.js 15 App Router, Server Actions (`"use server"`), `next/headers` cookies, `lucide-react`, Tailwind CSS.

---

## File Map

| Arquivo                            | Ação      | Responsabilidade                              |
| ---------------------------------- | --------- | --------------------------------------------- |
| `app/(app)/actions.ts`             | Criar     | Server Action `logoutAction`                  |
| `app/(app)/_components/header.tsx` | Criar     | Server Component `AppHeader`                  |
| `app/(app)/layout.tsx`             | Modificar | Incluir `<AppHeader />` acima de `{children}` |

> **Sem alterações em `models/`** — nenhuma lógica de domínio nova. Sem novos testes de integração necessários (a suite cobre apenas a camada `models/`).

---

### Task 1: Server Action de logout

**Files:**

- Create: `app/(app)/actions.ts`

- [ ] **Step 1: Criar a Server Action**

```typescript
// app/(app)/actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "lib/auth";

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
```

- [ ] **Step 2: Verificar que o arquivo compila sem erros**

```bash
npm run typecheck
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/actions.ts
git commit -m "feat: server action logoutAction limpa sessão e redireciona para /login"
```

---

### Task 2: Componente AppHeader

**Files:**

- Create: `app/(app)/_components/header.tsx`

O header exibe "Biblitec" à esquerda e `{usuario.nome}` + botão "Sair" à direita. O logout usa `<form action={logoutAction}>` — funciona sem JS e segue o padrão da `loginAction`.

- [ ] **Step 1: Criar o componente**

```tsx
// app/(app)/_components/header.tsx
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
        <span className="text-sm font-semibold text-gray-900">Biblitec</span>
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

- [ ] **Step 2: Verificar tipos**

```bash
npm run typecheck
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/_components/header.tsx
git commit -m "feat: AppHeader exibe nome do usuário e botão Sair"
```

---

### Task 3: Incluir header no layout autenticado

**Files:**

- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Atualizar o layout**

Conteúdo atual de `app/(app)/layout.tsx`:

```tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Substituir por:

```tsx
import { AppHeader } from "./_components/header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos e lint**

```bash
npm run lint:check && npm run typecheck
```

Expected: nenhum erro.

- [ ] **Step 3: Testar manualmente**

```bash
npm run dev
```

Verificar:

- Header aparece em `/livros` e na página de qualquer livro
- Nome do usuário exibido corretamente
- Clique em "Sair" limpa a sessão e redireciona para `/login`
- Ao tentar acessar `/livros` depois de sair, redireciona para `/login`

- [ ] **Step 4: Rodar a suite de testes**

```bash
npm test
```

Expected: todos os testes passando (nenhuma regressão).

- [ ] **Step 5: Commit**

```bash
git add app/(app)/layout.tsx
git commit -m "feat: inclui AppHeader no layout autenticado"
```
