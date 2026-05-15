# Design — Renovação de Empréstimo (Issue #63)

Data: 2026-05-15

## Contexto

A funcionalidade de renovação de empréstimo tem esqueleto do Milestone 2, mas com lacunas:

- Sem proteção contra race condition (falta transação + SELECT FOR UPDATE)
- Ordem de validações incorreta
- Erros sem código tipado na resposta da API
- Botão "Renovar" oculto no UI quando deveria ser desabilitado com tooltip
- Dialog com título/botão genéricos e erro sem Alert adequado
- Endpoint usa path `/loans/` em vez de `/emprestimos/` (padrão PT-BR do projeto)
- Testes faltando 4 dos 9 cenários obrigatórios

## Decisões de design

| Ponto               | Decisão                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| Assinatura do model | `renovarEmprestimo(input, contexto)` — alinhado ao padrão `(input, contexto)` |
| Classe de erro      | `AppError` com terceiro argumento `code` — já existe, sem overhead            |
| Path do endpoint    | Criar `/api/v1/emprestimos/[id]/renovar`; manter `/loans/` intocado           |
| Botão desabilitado  | `disabled` + `title` com explicação, nunca oculto (persona Maria)             |

## Arquivos afetados

| Arquivo                                                  | Ação                                            |
| -------------------------------------------------------- | ----------------------------------------------- |
| `models/emprestimos.ts`                                  | Modificar — renomear e melhorar `renovar`       |
| `app/api/v1/emprestimos/[id]/renovar/route.ts`           | Criar                                           |
| `app/api/v1/loans/[id]/renovar/route.ts`                 | Modificar — atualizar import do model renomeado |
| `app/(app)/emprestimos/_components/renovar-dialog.tsx`   | Modificar                                       |
| `app/(app)/emprestimos/_components/emprestimo-linha.tsx` | Modificar                                       |
| `tests/integration/emprestimos/renovar.test.ts`          | Criar                                           |

## 1. Model — `models/emprestimos.ts`

### Assinatura

```typescript
type RenovarEmprestimoInput = { emprestimoId: string };

export async function renovarEmprestimo(
  input: RenovarEmprestimoInput,
  contexto: Contexto,
): Promise<Emprestimo>;
```

### Lógica (dentro de transação com SELECT FOR UPDATE)

1. Buscar empréstimo por `id` com `FOR UPDATE` → se não existir: `AppError("Empréstimo não encontrado.", 404, "NAO_ENCONTRADO")`
2. Verificar autorização (gestor só vê sua giroteca via join com exemplares) → `AppError("Não autorizado.", 403, "NAO_AUTORIZADO")`
3. Verificar `dataDevolucao IS NOT NULL` → `AppError("Este empréstimo já foi devolvido.", 409, "JA_DEVOLVIDO")`
4. Verificar `dataPrevistaDevolucao < CURRENT_DATE` (PostgreSQL, evita timezone JS) → `AppError("Empréstimos em atraso não podem ser renovados...", 409, "EM_ATRASO")`
5. Verificar `renovacoes >= MAX_RENOVACOES` → `AppError("Este empréstimo já foi renovado 2 vezes...", 409, "LIMITE_RENOVACOES")`
6. Atualizar: `dataPrevistaDevolucao = dataPrevistaDevolucao + 14 dias` (a partir da data atual, não de hoje)
7. Retornar empréstimo atualizado

**Atenção ao timezone**: a comparação de atraso usa `sql\`${emprestimos.dataPrevistaDevolucao} < CURRENT_DATE\``para evitar bug de fuso JS. A nova data é calculada em JS a partir de`dataPrevistaDevolucao`atual (não de`new Date()`).

## 2. API Route — `app/api/v1/emprestimos/[id]/renovar/route.ts`

```
POST /api/v1/emprestimos/:id/renovar

Sucesso (200):    { emprestimo atualizado }
404:              { error: "Empréstimo não encontrado." }
403:              { error: "Não autorizado." }
409:              { code: "JA_DEVOLVIDO"|"EM_ATRASO"|"LIMITE_RENOVACOES", message: "..." }
500:              { error: "Erro interno." }
```

Mapeamento de `AppError.code` para status HTTP explícito no handler.

## 3. UI — `EmprestimoLinha`

Substituir lógica condicional que oculta o botão por lógica que o desabilita:

```tsx
// Antes: canRenovar(...) && <Button>Renovar</Button>
// Depois:
<Button
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

## 4. UI — `RenovarDialog`

Mudanças:

- Título: "Confirmar renovação" → "Renovar empréstimo"
- Botão primário: "Confirmar renovação" / "Renovando..." → "Renovar empréstimo" / "Renovando..."
- URL do fetch: `/api/v1/loans/` → `/api/v1/emprestimos/`
- Erro: `<p className="text-red-600">` → `<Alert variant="destructive">` com mensagem da API (requer instalar o componente: `npx shadcn@latest add alert`)
- Adicionar: `"Esta será a Xª renovação de 2 permitidas."` (calculado a partir de `emprestimo.renovacoes + 1`)

## 5. Testes — `tests/integration/emprestimos/renovar.test.ts`

9 cenários cobrindo o endpoint `/api/v1/emprestimos/[id]/renovar`:

1. ✅ Caminho feliz: data avança 14 dias, renovacoes = 1
2. ✅ Segunda renovação: renovacoes = 2
3. ❌ Terceira bloqueada: 409 + `code: "LIMITE_RENOVACOES"`
4. ❌ Em atraso: 409 + `code: "EM_ATRASO"`
5. ❌ Já devolvido: 409 + `code: "JA_DEVOLVIDO"`
6. ❌ Não encontrado: 404
7. 🔒 Gestor A não renova empréstimo da giroteca B: 403
8. 🔒 Admin NTE renova em qualquer giroteca: 200
9. ⚙️ Cálculo de data preserva ciclo: vence dia 14, renovado dia 10 → nova data é dia 28

Usa factories existentes em `tests/factories/index.ts`.

## Fora do escopo

- Tela de detalhes do empréstimo (`/emprestimos/[id]`) — não criar
- Notificação ao leitor — pós-MVP
- Renovação forçada para atrasados — regra é regra
