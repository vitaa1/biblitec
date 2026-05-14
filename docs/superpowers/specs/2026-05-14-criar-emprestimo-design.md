# Spec: Página `/emprestimos/novo` — Criar Empréstimo

**Data:** 2026-05-14
**Issue:** Criar empréstimo (Milestone 6)

---

## Problema

Não existe UI para registrar empréstimos. O modelo `criar()` em `models/emprestimos.ts` e a rota `POST /api/v1/loans` existem, mas:

1. A rota não aceita data de devolução customizada (sempre força hoje+14)
2. Os erros são genéricos — sem `code` para a UI diferenciar e mostrar mensagens específicas da spec da Maria
3. Não há endpoint para buscar exemplar por tombamento/ISBN com dados enriquecidos
4. Não há página `/emprestimos/novo`

Critério da Maria: "1 gestor real registra 5 empréstimos consecutivos sem pedir ajuda, incluindo 1 cenário de erro tratado corretamente."

---

## Seção 1 — Endpoint de busca de exemplar

**Novo:** `GET /api/v1/exemplares/buscar?q=<valor>`

**Lógica:**

1. Se `q` bate regex `/^\d{10}$|^\d{13}$/` → busca por ISBN, retorna primeiro exemplar `status=disponivel` da giroteca do gestor
2. Caso contrário → busca por `codigo_tombamento` exato na giroteca
3. Sempre filtra pela giroteca do gestor (admin recebe 400 — não opera empréstimo)

**Resposta — disponível:**

```json
{
  "exemplar": {
    "id": "...",
    "codigoTombamento": "T-001",
    "status": "disponivel"
  },
  "livro": {
    "titulo": "Dom Casmurro",
    "autores": "Machado de Assis",
    "capaUrl": "..."
  }
}
```

**Resposta — emprestado:**

```json
{
  "exemplar": {
    "id": "...",
    "codigoTombamento": "T-001",
    "status": "emprestado"
  },
  "livro": { "titulo": "...", "autores": "...", "capaUrl": "..." },
  "leitorAtual": {
    "nome": "Ana Lúcia",
    "turma": "5A",
    "dataEmprestimo": "2026-05-01T10:00:00Z"
  }
}
```

**Resposta — não encontrado:** `404` com `{ "error": "Exemplar não encontrado." }`

**Resposta — admin:** `400` com `{ "error": "Admin não opera empréstimos diretamente." }`

---

## Seção 2 — Mudanças no model `criar()`

**(a) Aceita `dataPrevistaDevolucao` opcional:**

```typescript
export async function criar(
  input: {
    exemplarId: string;
    leitorId: string;
    dataPrevistaDevolucao?: Date;
    observacoes?: string;
  },
  contexto: Contexto,
): Promise<Emprestimo>;
```

Validação:

- Se informada: deve estar entre `hoje` (00:00) e `hoje + 60 dias`. Fora do range: `AppError("Data de devolução fora do permitido (hoje até 60 dias).", 400)`
- Se omitida: usa `hoje + 14 dias`

**(b) Erros com `code`:**

| Mensagem                                                | `code`                   |
| ------------------------------------------------------- | ------------------------ |
| `"Exemplar não disponível para empréstimo."`            | `EXEMPLAR_INDISPONIVEL`  |
| `"Leitor inativo."`                                     | `LEITOR_INATIVO`         |
| `"Leitor já possui o máximo de empréstimos em aberto."` | `LEITOR_LIMITE_ATINGIDO` |
| `"Leitor possui empréstimo em atraso."`                 | `LEITOR_COM_ATRASO`      |

A classe `AppError` já tem o campo opcional `code` (criado para `MATRICULA_DUPLICADA`).

---

## Seção 3 — Contrato da API e schema Zod

**`infra/schemas.ts`:**

```typescript
export const createEmprestimoSchema = z.object({
  exemplarId: z.uuid("exemplarId deve ser um UUID válido."),
  leitorId: z.uuid("leitorId deve ser um UUID válido."),
  dataPrevistaDevolucao: z.coerce.date().optional(),
  observacoes: z.string().max(500).optional(),
});
```

**`POST /api/v1/loans` — erro com `code`:**

```json
{ "error": "Leitor inativo.", "code": "LEITOR_INATIVO" }
```

A rota usa o handler padrão de `AppError`. Estende-se para serializar `code` quando existir (mesmo padrão já aplicado em `/api/v1/leitores`).

---

## Seção 4 — Arquitetura da UI

**Arquivos:**

| Arquivo                                                      | Tipo             | Responsabilidade                         |
| ------------------------------------------------------------ | ---------------- | ---------------------------------------- |
| `app/(app)/emprestimos/novo/page.tsx`                        | Server Component | Valida contexto (gestor), renderiza form |
| `app/(app)/emprestimos/_components/novo-emprestimo-form.tsx` | Client Component | Lógica do formulário                     |

**Estado interno do form:**

```typescript
{
  buscaExemplar: string,
  exemplar: ExemplarBuscado | null,
  buscandoExemplar: boolean,

  buscaLeitor: string,
  leitoresEncontrados: Leitor[],
  leitorSelecionado: Leitor | null,
  buscandoLeitor: boolean,

  dataPrevistaDevolucao: string, // ISO 'YYYY-MM-DD'
  observacoes: string,
  observacoesAberto: boolean,

  salvando: boolean,
  erros: { exemplar?, leitor?, data?, geral? },
}
```

**Campo 1 — Exemplar (busca em tempo real, debounce 300ms):**

- **Disponível** → card verde com capa + título + autor + tombamento
- **Emprestado** → card amarelo: "Este exemplar está emprestado para Ana Lúcia, turma 5A, desde 12/03/2026"
- **Não encontrado** → card cinza "Nenhum exemplar encontrado para `T-001`"
- **Loading** → skeleton

**Campo 2 — Leitor (busca em tempo real, debounce 300ms):**

- 1 resultado exato (matrícula) → seleciona automaticamente
- Múltiplos → dropdown de sugestões (máximo 8), navegável com setas+enter
- Selecionado → card branco com nome + turma + tipo

**Campo 3 — Data prevista de devolução:**

`<input type="date">` com `min={hoje}`, `max={hoje+60}`, default `hoje+14`. Validação inline se fora do range.

**Bloco "Observações":**

`<details>` colapsado, `<textarea maxLength={500}>`.

**Botão "Confirmar empréstimo":**

Grande, verde (`bg-green-600 hover:bg-green-700`). Habilitado quando:

- `exemplar.status === 'disponivel'`
- `leitorSelecionado !== null`
- `dataPrevistaDevolucao` válida
- `!salvando`

**Teclado:**

- `autoFocus` no Campo 1
- `Enter` em qualquer campo (exceto `<textarea>`) → dispara submit se válido
- Após sucesso: form reseta, toast `sonner` "Empréstimo registrado para Ana Lúcia.", foco volta ao Campo 1

**Mapeamento de erros do submit:**

| `code`                   | Mensagem inline                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `EXEMPLAR_INDISPONIVEL`  | "Este exemplar foi emprestado por outro usuário. Recarregue a página."                  |
| `LEITOR_INATIVO`         | "Este leitor está desativado. Fale com o administrador."                                |
| `LEITOR_LIMITE_ATINGIDO` | "Este leitor já tem 3 empréstimos em aberto. É necessário devolver um antes."           |
| `LEITOR_COM_ATRASO`      | "Este leitor tem empréstimos em atraso. Registre a devolução antes de novo empréstimo." |
| outro                    | mensagem `body.error` ou "Erro ao registrar empréstimo."                                |

---

## Testes

**Integração (`POST /api/v1/loans`):**

- Caminho feliz (gestor cria empréstimo)
- `dataPrevistaDevolucao` customizada válida (hoje+30)
- `dataPrevistaDevolucao` no passado → 400
- `dataPrevistaDevolucao` > hoje+60 → 400
- Exemplar de outra giroteca (gestor) → 403
- Exemplar indisponível → 409 com `code=EXEMPLAR_INDISPONIVEL`
- Leitor inativo → 409 com `code=LEITOR_INATIVO`
- Leitor com 3 ativos → 409 com `code=LEITOR_LIMITE_ATINGIDO`
- Leitor com atraso → 409 com `code=LEITOR_COM_ATRASO`

**Integração (`GET /api/v1/exemplares/buscar`):**

- Tombamento existente disponível → 200 + dados completos
- Tombamento existente emprestado → 200 + `leitorAtual`
- ISBN com exemplar disponível → 200 + dados do primeiro disponível
- ISBN sem exemplar disponível na giroteca → 404
- Tombamento de outra giroteca → 404 (filtro por girotecaId)
- Admin → 400

---

## Arquivos afetados

| Arquivo                                                      | Ação                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `models/emprestimos.ts`                                      | Modificar — `criar()` aceita data, adiciona `code` nos erros    |
| `models/exemplares.ts`                                       | Modificar — adicionar `buscarParaEmprestimo(query, contexto)`   |
| `infra/schemas.ts`                                           | Modificar — `dataPrevistaDevolucao` no `createEmprestimoSchema` |
| `app/api/v1/loans/route.ts`                                  | Modificar — serializar `code` na resposta de erro               |
| `app/api/v1/exemplares/buscar/route.ts`                      | Criar — endpoint de busca enriquecida                           |
| `app/(app)/emprestimos/novo/page.tsx`                        | Criar — Server Component                                        |
| `app/(app)/emprestimos/_components/novo-emprestimo-form.tsx` | Criar — Client Component                                        |
| `app/(app)/_components/header.tsx`                           | Modificar — adicionar link "Novo empréstimo"                    |
| `tests/integration/api/v1/loans/post.test.ts`                | Modificar — cobrir data customizada e códigos de erro           |
| `tests/integration/api/v1/exemplares/buscar.test.ts`         | Criar — testes do endpoint de busca                             |

## Fora de escopo

- Página `/emprestimos` (listagem) — issue separada
- Página `/devolucoes` — issue separada
- Endpoint expondo `renovar` — issue separada
- Renomear `/api/v1/loans` → `/api/v1/emprestimos` — issue separada
- Definir o que admin_nthe vê — admin não opera empréstimo, retorna 400 no endpoint de busca
