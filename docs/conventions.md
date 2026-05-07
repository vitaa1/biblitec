# Convenções de código

Detalhamento das convenções do Biblitec. Para o resumo, veja [`CLAUDE.md`](../CLAUDE.md) seção 8.

## Idioma

- **Código em inglês** (variáveis, funções, classes, comentários técnicos).
- **UI em português** (textos visíveis, labels, mensagens).
- **Domínio em português** (tabelas, colunas, tipos do domínio: `livros`, `exemplares`, `emprestimos`, `giroteca_id`).

Resultado misto e proposital:

```typescript
export async function listarEmprestimosAtivos(girotecaId: string) {
  const result = await db
    .select()
    .from(emprestimos)
    .where(
      and(
        eq(emprestimos.girotecaId, girotecaId),
        isNull(emprestimos.dataDevolucao),
      ),
    );
  return result;
}
```

## Naming

| Elemento                       | Convenção                                       | Exemplo                                           |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| Tabelas e colunas              | `snake_case` em português                       | `codigo_tombamento`, `data_prevista_devolucao`    |
| Tipos TS / variáveis (infra)   | `camelCase` em inglês                           | `getUserById`, `parseDate`                        |
| Tipos TS / variáveis (domínio) | `camelCase` em português                        | `livro`, `criarEmprestimo`                        |
| Componentes React              | `PascalCase` (termo de domínio em português OK) | `LivroCard`, `EmprestimoForm`                     |
| Arquivos                       | `kebab-case`                                    | `emprestimo-form.tsx`, `criar-emprestimo.ts`      |
| Constantes                     | `UPPER_SNAKE_CASE`                              | `MAX_EMPRESTIMOS_ATIVOS`, `DIAS_PRAZO_PADRAO`     |
| Handlers                       | prefixo `handle`                                | `handleSubmit`, `handleLivroSelect`               |
| Booleanos                      | prefixo `is`/`has`/`can`                        | `isAtrasado`, `canRenovar`, `hasEmprestimoAberto` |

## Erros

Erros tipados em `models/`:

```typescript
class EmprestimoError extends Error {
  constructor(
    public code:
      | "EXEMPLAR_INDISPONIVEL"
      | "LEITOR_INATIVO"
      | "LIMITE_EXCEDIDO"
      | "EM_ATRASO",
    message: string,
  ) {
    super(message);
  }
}
```

API routes traduzem o código em mensagem HTTP + mensagem amigável para a UI. Nunca `throw new Error("algo deu errado")` sem código.

Mensagens para a UI sempre em português, sem jargão técnico:

- ❌ `Error 409: unique constraint violation on exemplares_codigo_tombamento_giroteca_id_idx`
- ✅ `Já existe um exemplar com esse código de tombamento nesta giroteca.`

## Datas

- **No banco:** `timestamp with time zone` para eventos (`created_at`), `date` para datas de domínio (`data_emprestimo`).
- **No código:** usar `Date` nativo. Não introduza dayjs/moment sem necessidade real.
- **Formatação para exibir:** helpers em `lib/format.ts`, sempre `pt-BR`.

## Filosofia de código

- **Simplicidade > esperteza.** Código que qualquer dev lê em 30 segundos é melhor que código "elegante" que exige 5 minutos.
- **Menos código = menos dívida.** Não adicione abstração sem necessidade concreta. Abstraia quando o padrão se repetir 3 vezes, não na primeira.
- **Early returns** para evitar aninhamento. Verifique a condição de erro no topo e retorne cedo.
- **Constantes com nome** em vez de números mágicos. `MAX_EMPRESTIMOS_ATIVOS` é mais claro que `3`.
- **Construa de forma iterativa.** Mínimo funcional → valida → adiciona complexidade.
- **Empurre detalhes de implementação para as bordas.** A lógica central de `models/` deve ler como regras de negócio.
- **Mudanças mínimas.** Só modifique o necessário para a tarefa. Refatorações oportunistas vão em PR separado.

## Commits

Conventional Commits, em português:

```
feat: adiciona tela de empréstimo
fix: corrige cálculo de dias de atraso
refactor: extrai validação de tombamento para helper
docs: atualiza README com instruções de seed
test: cobre fluxo de renovação de empréstimo
chore: atualiza dependências
```

- Commits atômicos — uma mudança lógica por commit.
- Título ≤72 chars. Corpo explica **por quê**, não **o quê** (o diff já mostra o quê).
- No branch de feature, mantenha histórico granular. Squash só ao mergear em `main`.
