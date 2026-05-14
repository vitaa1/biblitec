# Spec: Página `/devolucoes` — Tela de Devolução

**Data:** 2026-05-14
**Issue:** Tela de devolução (Milestone 6)
**Issue irmã:** Tela de novo empréstimo (`/emprestimos/novo`)

---

## Problema

Não existe UI para registrar devoluções. O modelo `devolver()` em `models/emprestimos.ts` e a rota `PATCH /api/v1/loans/[id]` existem, mas:

1. A função `devolver()` não registra o estado físico do exemplar no momento da devolução
2. Não há função de busca para encontrar um empréstimo ativo por tombamento ou ISBN
3. Não há endpoint de busca para devolução (o existente `/api/v1/exemplares/buscar` busca exemplares DISPONÍVEIS — para novos empréstimos)
4. Não há página `/devolucoes`

Critério da Maria: gestor real registra 5 devoluções consecutivas sem pedir ajuda, incluindo 1 cenário de atraso e 1 de dano grave.

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Acesso ao screen | Gestor apenas | Padrão de `/emprestimos/novo`; admin usa API se necessário |
| Default de "Estado na devolução" | Sem seleção (não altera estado) | Não sobrescrever estado anterior inadvertidamente |
| Mapeamento de estado UI → DB | "Bom" → `bom`, "Danificado leve" → `regular`, "Danificado grave" → `danificado` | Reutiliza enum existente `estadoExemplarEnum` |
| Cor do botão de confirmação | Azul (`bg-blue-600`) | Diferencia visualmente do verde de empréstimo |
| Baixa após devolução | Oferecida, não forçada | Dialog opcional após sucesso com "Danificado grave" |
| Estado do exemplar se gestor recusar baixa | `disponivel` com `estado = "danificado"` | Registro físico mantido; histórico preservado |

---

## Seção 1 — Model: `models/emprestimos.ts`

### Nova função `buscarParaDevolucao(query, contexto)`

Resolve tombamento ou ISBN para um empréstimo ativo na giroteca do gestor. Retorna dados completos para o card de confirmação, ou `null` com código de erro.

**Assinatura:**

```typescript
type BuscaDevResult =
  | { ok: true; data: EmprestimoParaDevolucao }
  | { ok: false; code: "NAO_ENCONTRADO" | "SEM_EMPRESTIMO_ABERTO" | "MULTIPLOS_EMPRESTADOS" | "EXEMPLAR_BAIXADO" };

export async function buscarParaDevolucao(
  query: string,
  contexto: Contexto,
): Promise<BuscaDevResult>;
```

**Tipo de retorno de sucesso:**

```typescript
type EmprestimoParaDevolucao = {
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
```

**Lógica de resolução:**

```
query é ISBN (regex /^\d{10}$|^\d{13}$/)?
  SIM:
    → busca livros por isbn
    → se não encontrar livro → { ok: false, code: "NAO_ENCONTRADO" }
    → busca exemplares com status='emprestado' e girotecaId=contexto.girotecaId
    → se 0 resultados → { ok: false, code: "SEM_EMPRESTIMO_ABERTO" }
    → se >1 resultados → { ok: false, code: "MULTIPLOS_EMPRESTADOS" }
    → se 1 resultado → resolve normalmente (busca emprestimo ativo + leitor)
  NÃO (tombamento):
    → busca exemplares por codigoTombamento + girotecaId
    → se não encontrar → { ok: false, code: "NAO_ENCONTRADO" }
    → se status = "baixado" → { ok: false, code: "EXEMPLAR_BAIXADO" }
    → se status = "disponivel" → { ok: false, code: "SEM_EMPRESTIMO_ABERTO" }
    → se status = "emprestado" → resolve normalmente (busca emprestimo ativo + leitor)
```

Autorização: a função filtra sempre por `contexto.girotecaId`. Gestor da giroteca A tentando buscar tombamento da giroteca B recebe `NAO_ENCONTRADO` (não vaza existência).

Throw `AppError` se `contexto.papel !== "gestor_giroteca"` (admin não usa esta tela).

### Extensão de `devolver(id, contexto, opcoes?)`

```typescript
export async function devolver(
  id: string,
  contexto: Contexto,
  opcoes?: { estadoRetorno?: "bom" | "regular" | "danificado" },
): Promise<Emprestimo>
```

Dentro da transação existente, se `opcoes?.estadoRetorno` for fornecido, o `update exemplares` também aplica `estado = opcoes.estadoRetorno`. Sem mudança de comportamento para chamadas sem `opcoes`.

---

## Seção 2 — API Routes

### `GET /api/v1/emprestimos/buscar-devolucao?q=<query>`

Arquivo: `app/api/v1/emprestimos/buscar-devolucao/route.ts`

| Resultado de `buscarParaDevolucao` | HTTP | Body |
|---|---|---|
| `{ ok: true, data }` | 200 | `EmprestimoParaDevolucao` (com datas serializadas ISO) |
| `NAO_ENCONTRADO` | 404 | `{ error: "Nenhum exemplar com esse código foi encontrado nesta giroteca." }` |
| `SEM_EMPRESTIMO_ABERTO` | 404 | `{ error: "Este exemplar não está emprestado no momento.", code: "SEM_EMPRESTIMO_ABERTO" }` |
| `MULTIPLOS_EMPRESTADOS` | 409 | `{ error: "Há mais de um exemplar deste livro emprestado. Use o código de tombamento.", code: "MULTIPLOS_EMPRESTADOS" }` |
| `EXEMPLAR_BAIXADO` | 404 | `{ error: "Este exemplar foi baixado do acervo.", code: "EXEMPLAR_BAIXADO" }` |
| Admin | 400 | `{ error: "Admin não opera devoluções diretamente." }` |
| `q` ausente/vazio | 400 | `{ error: "Parâmetro 'q' é obrigatório." }` |

### `PATCH /api/v1/loans/[id]` — extensão

Arquivo: `app/api/v1/loans/[id]/route.ts` — aceita body JSON opcional.

Novo schema Zod em `infra/schemas.ts`:

```typescript
export const devolverEmprestimoSchema = z.object({
  estadoRetorno: z.enum(["bom", "regular", "danificado"]).optional(),
});
```

Se body for vazio/ausente: `estadoRetorno = undefined` (comportamento atual preservado).

### `PATCH /api/v1/exemplares/[id]/baixar` — sem mudança

Já existe. A UI chama com `{ motivo: "Danificado" }` pré-preenchido.

---

## Seção 3 — UI

### Arquivos

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `app/(app)/devolucoes/page.tsx` | Server Component | Valida contexto (gestor), renderiza form |
| `app/(app)/devolucoes/_components/devolucao-form.tsx` | Client Component | Estado e interação |
| `app/(app)/_components/header.tsx` | Modificar | Adicionar link "Devoluções" na nav |

### Estado interno

```typescript
{
  busca: string,
  resultado: EmprestimoParaDevolucao | null,
  erroBusca: string | null,       // mensagem inline sob o campo
  buscando: boolean,

  estadoRetorno: "" | "bom" | "regular" | "danificado",  // "" = sem seleção

  confirmando: boolean,
  erroConfirmacao: string | null,

  mostrarDialogBaixa: boolean,
  exemplarIdParaBaixa: string | null,
}
```

### Campo de busca

- Label: `"Código de tombamento ou ISBN"`
- `id="campo-busca"` com `autoFocus` no `useEffect` inicial
- Ícone `<Search>` à esquerda (padrão do form de empréstimo)
- Placeholder: `"Ex: T-001 ou 9788535910663"`
- Debounce 300ms → GET `/api/v1/emprestimos/buscar-devolucao?q=`
- Limpar campo → `resultado = null`, `erroBusca = null`
- Loading: `<Loader2 className="animate-spin">` + "Buscando…" (igual ao form de empréstimo)

### Mensagens inline sob o campo (sem toast)

| `code` na resposta | Mensagem |
|---|---|
| `SEM_EMPRESTIMO_ABERTO` | "Este exemplar não está emprestado no momento." |
| `MULTIPLOS_EMPRESTADOS` | "Há mais de um exemplar deste livro emprestado. Use o código de tombamento." |
| `EXEMPLAR_BAIXADO` | "Este exemplar foi baixado do acervo." |
| sem code (404) | "Nenhum exemplar com esse código foi encontrado nesta giroteca." |
| erro de rede | "Sem conexão com o servidor. Tente novamente." |

### Card de confirmação (aparece quando `resultado !== null`)

Hierarquia visual (Gestalt: proximidade + hierarquia):

```
┌─────────────────────────────────────────┐
│ [CAPA]  Dom Casmurro                    │  ← título: font-semibold
│         Machado de Assis                │  ← autores: text-sm text-gray-600
│         T-001                           │  ← tombamento: font-mono text-xs
├─────────────────────────────────────────┤
│ Ana Lúcia · Turma 5A                    │  ← nome: font-semibold
│ Emprestado em 01/05/2026                │  ← data: text-sm text-gray-600
│ ⚠ 5 dias em atraso                      │  ← só se atrasado: text-red-600 font-medium
└─────────────────────────────────────────┘
```

Dias de atraso: `Math.floor((Date.now() - dataPrevistaDevolucao.getTime()) / 86_400_000)`. Só renderizar se `> 0`.

Border: `border-gray-200`. Sem destaque colorido no card (o vermelho do atraso já chama atenção).

### Select "Estado na devolução"

- Label: `"Estado na devolução (opcional)"`
- Placeholder (SelectValue): `"Não informado"`
- Opções: "Bom" → `"bom"`, "Danificado leve" → `"regular"`, "Danificado grave" → `"danificado"`
- Visivelmente secundário (text-sm, abaixo do card)
- Se não selecionado: `estadoRetorno = ""` → não envia no body da requisição

### Botão "Confirmar devolução"

```tsx
<Button
  type="submit"
  disabled={!resultado || confirmando}
  className="w-full bg-blue-600 py-6 text-base hover:bg-blue-700"
>
  {confirmando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Confirmar devolução
</Button>
```

### Submit

```typescript
async function handleSubmit(e) {
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
      const data = await res.json();
      setErroConfirmacao(data.error ?? "Erro ao registrar devolução.");
      return;
    }
    toast.success("Devolução registrada.");
    if (estadoRetorno === "danificado") {
      setExemplarIdParaBaixa(resultado.exemplar.id);
      setMostrarDialogBaixa(true);
      // form NÃO reseta ainda — espera decisão do dialog
    } else {
      resetar();
    }
  } finally {
    setConfirmando(false);
  }
}
```

### Dialog de baixa (pós-devolução "Danificado grave")

Aparece após `mostrarDialogBaixa = true`. Segue o padrão de `BaixarExemplarDialog`:

- Título: "Deseja baixar este exemplar?"
- Descrição: "O exemplar foi devolvido com estado Danificado grave. Você pode retirá-lo do acervo agora."
- Select de motivo pré-preenchido com "Danificado" (editável)
- Aviso: "Tem certeza? Esta ação não pode ser desfeita."
- Botões: "Não, manter no acervo" (outline) | "Confirmar baixa" (destructive)
- Cancelar: dialog fecha + `resetar()` (exemplar fica `disponivel` com `estado = "danificado"`)
- Confirmar: `PATCH /api/v1/exemplares/{exemplarId}/baixar` com `{ motivo }` + toast "Exemplar baixado do acervo." + `resetar()`

### Função `resetar()`

```typescript
function resetar() {
  setBusca("");
  setResultado(null);
  setErroBusca(null);
  setEstadoRetorno("");
  setErroConfirmacao(null);
  setMostrarDialogBaixa(false);
  setExemplarIdParaBaixa(null);
  refBusca.current?.focus();
}
```

---

## Seção 4 — Testes

### `tests/integration/models/emprestimos.test.ts` — novos casos

| Caso de teste | Expectativa |
|---|---|
| `buscarParaDevolucao()` por tombamento com empréstimo ativo | `{ ok: true, data }` com todos os campos |
| `buscarParaDevolucao()` por tombamento sem empréstimo aberto (`disponivel`) | `{ ok: false, code: "SEM_EMPRESTIMO_ABERTO" }` |
| `buscarParaDevolucao()` por tombamento de exemplar `baixado` | `{ ok: false, code: "EXEMPLAR_BAIXADO" }` |
| `buscarParaDevolucao()` por ISBN com 1 exemplar emprestado | `{ ok: true, data }` |
| `buscarParaDevolucao()` por ISBN com >1 exemplares emprestados | `{ ok: false, code: "MULTIPLOS_EMPRESTADOS" }` |
| `buscarParaDevolucao()` por tombamento de outra giroteca | `{ ok: false, code: "NAO_ENCONTRADO" }` (não vaza) |
| `devolver()` com `estadoRetorno: "regular"` | `dataDevolucao` preenchida + `exemplares.estado = "regular"` |
| `devolver()` sem `estadoRetorno` | `dataDevolucao` preenchida + `exemplares.estado` inalterado |
| `devolver()` gestor A tenta devolver empréstimo de giroteca B | lança `AppError` 403 |

### `tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts` — novo arquivo

| Caso | Status |
|---|---|
| Tombamento com empréstimo ativo | 200 + dados completos |
| Tombamento sem empréstimo (disponivel) | 404 + `code: "SEM_EMPRESTIMO_ABERTO"` |
| ISBN com >1 emprestados na giroteca | 409 + `code: "MULTIPLOS_EMPRESTADOS"` |
| Tombamento de outra giroteca | 404 sem revelar existência |
| Exemplar baixado | 404 + `code: "EXEMPLAR_BAIXADO"` |
| Admin | 400 |
| `q` ausente | 400 |

### `tests/integration/api/v1/loans/patch.test.ts` — extensão existente

| Caso | Status |
|---|---|
| Devolução em dia (caminho feliz) | 200, `dataDevolucao` preenchida |
| Devolução em atraso | 200 (atraso é visual; não bloqueia devolução) |
| Devolução com `estadoRetorno: "danificado"` | 200 + `exemplares.estado = "danificado"` |
| Devolução sem `estadoRetorno` | 200 + `exemplares.estado` inalterado |
| Gestor A tenta devolver empréstimo de giroteca B | 403 |
| ID inexistente / já devolvido | 404 |

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `models/emprestimos.ts` | Modificar — adicionar `buscarParaDevolucao()`, estender `devolver()` |
| `infra/schemas.ts` | Modificar — adicionar `devolverEmprestimoSchema` |
| `app/api/v1/emprestimos/buscar-devolucao/route.ts` | Criar — endpoint de busca para devolução |
| `app/api/v1/loans/[id]/route.ts` | Modificar — aceitar body com `estadoRetorno` |
| `app/(app)/devolucoes/page.tsx` | Criar — Server Component |
| `app/(app)/devolucoes/_components/devolucao-form.tsx` | Criar — Client Component |
| `app/(app)/_components/header.tsx` | Modificar — link "Devoluções" na nav |
| `tests/integration/models/emprestimos.test.ts` | Modificar — novos casos |
| `tests/integration/api/v1/emprestimos/buscar-devolucao.test.ts` | Criar |
| `tests/integration/api/v1/loans/patch.test.ts` | Modificar — casos com `estadoRetorno` |

## Fora de escopo

- Listagem de devoluções (histórico) — issue separada
- Renovação via UI — issue separada
- Acesso de admin_nthe à tela `/devolucoes` — admin usa API diretamente
- Notificações por email/SMS de atraso — pos-mvp
