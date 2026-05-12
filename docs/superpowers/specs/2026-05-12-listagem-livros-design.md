# Design — Listagem de Livros com Busca

**Milestone 4 — CRUD de Catálogo | Issue: listagem de livros com busca**
Data: 2026-05-12

---

## Contexto

`/livros` é a principal entrada para gestores acessarem o catálogo. A Maria precisa localizar um livro rapidamente (por título, autor ou ISBN) antes de registrar um empréstimo. O backend (models + API) para livros já existe — este issue cria a interface.

---

## Decisões de arquitetura

### 1. Rota da API: `/api/v1/livros` (migração de `/api/v1/books`)

A pasta `/api/v1/books` é renomeada para `/api/v1/livros`. Não será criado endpoint paralelo.  
O middleware passa de `pathname.startsWith("/api/v1/books")` para `/api/v1/livros`.  
Todos os imports internos são atualizados na mesma branch.

### 2. Route group `(app)` com layout mínimo

Criado `app/(app)/layout.tsx` com wrapper HTML mínimo para páginas autenticadas.  
Navegação principal fica para issue separada.  
`/livros` vive em `app/(app)/livros/page.tsx`.

### 3. Fluxo Server Component → Client Component

`page.tsx` (Server Component) chama `buscarComFiltros` sem filtros → recebe `{ livros, total }` → passa como prop `initialData` para `<LivroList initialData={...} />`.  
O Client Component usa `initialData` no estado inicial — sem flash de loading no primeiro acesso.  
Fetches subsequentes (busca, paginação) são gerenciados pelo Client Component via `/api/v1/livros`.

### 4. `buscarComFiltros` substitui `buscar`

A função `buscar()` em `models/livros.ts` é removida.  
`buscarComFiltros` cobre todos os casos: busca livre, busca por ISBN, paginação e contagem de exemplares via JOIN.  
A nova rota `/api/v1/livros/route.ts` usa exclusivamente `buscarComFiltros`.

### 5. Tipo `LivroComExemplares`

```ts
export type LivroComExemplares = Livro & {
  qtdDisponiveis: number; // exemplares status='disponivel' da giroteca do contexto (global p/ admin_nthe)
};
```

---

## Arquivos a criar / modificar

```
app/(app)/
  layout.tsx                        # CRIAR — wrapper mínimo para páginas autenticadas
  livros/
    page.tsx                        # CRIAR — Server Component, carrega initialData
    loading.tsx                     # CRIAR — Skeleton de carregamento (Suspense)
    _components/
      livro-search-input.tsx        # CRIAR — Input com debounce 300ms + detecção ISBN
      livro-list.tsx                # CRIAR — Client Component, gerencia estado + fetch
      livro-list-item.tsx           # CRIAR — Linha individual (capa, título, autor, exemplares)
      livro-list-skeleton.tsx       # CRIAR — Skeleton das linhas

app/api/v1/livros/route.ts          # CRIAR (renomear de books/) — GET com q, isbn, page
app/api/v1/books/                   # REMOVER (renomeado para livros/)

models/livros.ts                    # MODIFICAR — buscarComFiltros substitui buscar
middleware.ts                       # MODIFICAR — /books → /livros na rota pública
```

---

## Model

```ts
type FiltrosLivro = {
  q?: string;       // ILIKE em título e autores
  isbn?: string;    // match exato (sem hifens)
  page?: number;    // default 1
  limit?: number;   // default 50
};

export type LivroComExemplares = Livro & {
  qtdDisponiveis: number;
};

export async function buscarComFiltros(
  filtros: FiltrosLivro,
  contexto: Contexto,
): Promise<{ livros: LivroComExemplares[]; total: number }>
```

Query usa `LEFT JOIN exemplares` com `COUNT(*) FILTER (WHERE status = 'disponivel' AND giroteca_id = $1)`.  
Para `admin_nthe`, o filtro de giroteca é omitido — contagem global.  
Sem N+1: a contagem de exemplares é agregada no mesmo `SELECT`.

---

## API

```
GET /api/v1/livros?q=dom+casmurro&page=1
GET /api/v1/livros?isbn=9788535902778
```

Retorna: `{ livros: LivroComExemplares[], total: number, page: number, totalPages: number }`

Query params validados com Zod. Contexto vem exclusivamente do cookie JWT (via header injetado pelo middleware).

---

## Componentes

**`livro-search-input.tsx`** — Client Component  
- `useRef` no input, auto-foco ao montar  
- Debounce 300ms com `useEffect` + `setTimeout`  
- Detecta ISBN: `if (/^\d{10,13}$/.test(value.replace(/-/g, '')))` → usa param `isbn`, senão `q`  
- Ao limpar campo, reseta para página 1

**`livro-list.tsx`** — Client Component  
- Recebe `initialData` como estado inicial  
- `AbortController` cancela request anterior a cada nova busca (evita race condition)  
- Navegação por teclado: setas movem `focusedIndex`, Enter navega para `/livros/[id]`  
- Paginação: "Anterior" / "Próxima" + "Página X de Y"  
- Estados: loading / erro / vazio / lista

**`livro-list-item.tsx`** — Client Component  
- `tabIndex={0}`, `role="row"` (ou `<button>`)  
- `focus-visible:ring-2` para foco visível  
- Linha com `qtdDisponiveis === 0`: fundo `red-50`, texto `red-700`  
- Fallback de capa: ícone de livro cinza quando URL quebrada

---

## Layout de cada linha

```
[ CAPA 40×56px ] [ Título (semibold, truncate)  ] [ ● N disponíveis ]
                  [ Autor (sm, muted)            ]
```

Linha com 0 exemplares: fundo vermelho-50, contador em vermelho-700.

---

## Edge cases

| Cenário | Comportamento |
|---|---|
| ISBN com hifens | Limpar antes de comparar |
| Busca sem resultados | "Nenhum livro encontrado para '[termo]'." |
| Giroteca sem exemplares | Exibir livro com "0 disponíveis" em vermelho |
| Admin NTHE | Contagem global, sem filtro de giroteca |
| Campo limpo | Recarregar lista completa (página 1) |
| Página maior que total | Redirecionar para última página válida |
| Capa indisponível | Fallback ícone cinza |
| Caracteres especiais | Drizzle parametriza — sem risco de injection |

---

## Testes obrigatórios

`tests/integration/livros/buscar.test.ts`

- Busca por título parcial retorna resultados corretos
- Busca por ISBN exato retorna o livro certo
- Gestor vê apenas exemplares da sua giroteca (não da giroteca B)
- Admin NTHE vê contagem global
- Busca sem resultados retorna array vazio, não erro
- Paginação: página 2 não repete itens da página 1

---

## Checklist antes do PR

- [ ] Query sem N+1 (verificar com EXPLAIN ANALYZE em dev)
- [ ] Filtro de giroteca presente e testado
- [ ] Debounce + AbortController implementados
- [ ] Navegação por teclado funcional (Tab + setas + Enter)
- [ ] Foco visível nunca removido sem substituto
- [ ] Linhas com 0 exemplares destacadas em vermelho
- [ ] Capa com fallback para URL quebrada
- [ ] Viewport 1024px sem scroll horizontal
- [ ] Mensagens de estado em português
