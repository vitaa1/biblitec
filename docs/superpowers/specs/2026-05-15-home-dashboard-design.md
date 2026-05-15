# Home Dashboard — Indicador de Situação (Issue #55) Design

## Goal

Criar a página inicial autenticada (`/`) que exibe dois cards de métricas (empréstimos em aberto e atrasados) e três atalhos de ação rápida, permitindo que o operador da giroteca veja de imediato a situação dos empréstimos e acesse os fluxos mais frequentes sem navegar por menus.

## Architecture

A página é um Server Component em `app/(app)/page.tsx`. Os dados são buscados diretamente no servidor via `contarResumoEmprestimos(contexto)` — sem rota de API intermediária. Os subcomponentes (`CardResumo`, `AtalhosRapidos`) são TSX puro sem estado.

O `app/page.tsx` atual (landing pública com botão "Acessar o sistema") será deletado. O `middleware.ts` já redireciona usuários não autenticados de `/` para `/login`, tornando a landing pública desnecessária.

Fluxo de dados:
```
middleware → (autenticado) → app/(app)/page.tsx
                               ↓
                         contextoFromServerComponent()
                               ↓
                         contarResumoEmprestimos(contexto)
                               ↓
                         <CardResumo> + <AtalhosRapidos>
```

## Data Layer

Nova função em `models/emprestimos.ts`:

```typescript
export async function contarResumoEmprestimos(
  contexto: Contexto,
): Promise<{ emAberto: number; atrasados: number }>
```

**Lógica:**
- `emAberto`: `COUNT(*)` onde `dataDevolucao IS NULL`, filtrado por `girotecaId` quando `gestor_giroteca`
- `atrasados`: `COUNT(*)` onde `dataDevolucao IS NULL AND dataPrevistaDevolucao < hoje`, filtrado da mesma forma
- `hoje` calculado como `Date.UTC(...)` para evitar bugs de timezone (UTC-3 de Teresina)

**Contadores independentes:** `atrasados` é subconjunto de `emAberto`. Um empréstimo atrasado conta nos dois cards. Se há 23 empréstimos ativos e 7 atrasados: Em aberto = 23, Atrasados = 7.

**Multi-tenancy:** `admin_nthe` vê a soma de todas as girotecas. `gestor_giroteca` vê apenas os empréstimos da sua giroteca (`contexto.girotecaId`).

## Components

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `app/(app)/page.tsx` | Server Component | Busca dados, orquestra layout |
| `app/(app)/_components/card-resumo.tsx` | TSX puro | Renderiza um card com número grande, rótulo e link |
| `app/(app)/_components/atalhos-rapidos.tsx` | TSX puro | Renderiza três botões de atalho como `<Link>` |
| `app/(app)/error.tsx` | Client Component | Boundary de erro com mensagem amigável + retry |

### Layout (Opção A — aprovado)

```
┌─────────────────────────────────────────┐
│  Em aberto          │  Atrasados         │
│  [número grande]    │  [número vermelho] │
│  empréstimos ativos │  empréstimos atr.  │
└─────────────────────────────────────────┘
┌────────────┐ ┌────────────┐ ┌────────────┐
│ + Novo     │ │ ↩ Devolução│ │ + Cadastrar│
│ empréstimo │ │            │ │   leitor   │
└────────────┘ └────────────┘ └────────────┘
```

Cards são clicáveis e navegam para:
- Em aberto → `/emprestimos`
- Atrasados → `/emprestimos?aba=atrasados`

### Atalhos

| Rótulo | Destino |
|---|---|
| + Novo empréstimo | `/emprestimos/novo` |
| ↩ Devolução | `/emprestimos?aba=devolucao` |
| + Cadastrar leitor | `/leitores/novo` |

## Error Handling

`app/(app)/error.tsx` captura erros de Server Components. Exibe:
- Mensagem: "Não foi possível carregar os dados da giroteca. Tente novamente."
- Botão "Tentar novamente" que chama `reset()` do Next.js

Erros de banco são logados no servidor mas não expostos ao cliente.

## Files to Create/Modify/Delete

- **Criar:** `app/(app)/page.tsx`
- **Criar:** `app/(app)/_components/card-resumo.tsx`
- **Criar:** `app/(app)/_components/atalhos-rapidos.tsx`
- **Criar:** `app/(app)/error.tsx`
- **Modificar:** `models/emprestimos.ts` — adicionar `contarResumoEmprestimos`
- **Deletar:** `app/page.tsx`
- **Criar:** `tests/integration/home/resumo.test.ts`

## Testing

Testes de integração em `tests/integration/home/resumo.test.ts` testam a função de modelo diretamente (sem rota HTTP, pois não há endpoint de API):

1. `admin_nthe` recebe soma de todas as girotecas
2. `gestor_giroteca` recebe apenas contagem da sua giroteca (isolamento multi-tenant)
3. Empréstimo devolvido não entra em nenhum contador
4. Empréstimo atrasado conta em `emAberto` E em `atrasados`
5. Empréstimo no prazo conta apenas em `emAberto`, não em `atrasados`
6. Gestor de giroteca B não vê empréstimos da giroteca A

## Out of Scope

- Gráficos ou histórico de tendências (pos-mvp)
- Cards adicionais (total de leitores, livros, etc.)
- Animações nos números
- Atualização em tempo real (WebSocket/polling)
