# Decisões arquiteturais

Registro das decisões importantes do projeto e suas justificativas. Evita que as mesmas discussões aconteçam mais de uma vez.

| Decisão                    | Escolha                              | Alternativas descartadas                    | Justificativa                                                                                |
| -------------------------- | ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Framework                  | Next.js 15 + App Router              | Pages Router (legado); SPA separada         | Server Components reduzem JS no cliente — importante para computadores antigos das girotecas |
| Linguagem                  | TypeScript estrito                   | JavaScript puro                             | Domínio rico (livros, exemplares, empréstimos, status) sofre muito sem tipos                 |
| ORM                        | Drizzle + drizzle-kit                | `pg` puro; Prisma                           | SQL-first com tipagem forte. `pg` puro é arriscado com 6+ tabelas; Prisma é "mágico demais"  |
| Multi-tenancy              | Filtro por `giroteca_id` nas queries | Schemas separados por tenant                | Dezenas de girotecas, não milhares — schema separado adiciona complexidade sem benefício     |
| Autenticação               | JWT em cookie httpOnly + bcryptjs    | Auth.js; Clerk; Supabase Auth; login social | Sistema interno de prefeitura; sem necessidade de provider externo ou login social           |
| Componentes                | shadcn/ui                            | Material UI; Chakra; Radix puro             | Componentes copiados pra dentro do projeto (controle total + acessibilidade)                 |
| Testes                     | Integração contra Postgres real      | Mocks extensivos                            | Mocks não detectam bugs de constraint, transação ou autorização                              |
| Leitores                   | Sem login no MVP                     | Catálogo público com login de aluno         | Aumentaria complexidade sem benefício claro pros gestores                                    |
| Dados bibliográficos       | `livros` separado de `exemplares`    | Tabela única com duplicação                 | Tabela única duplicaria dados e complicaria o modelo de catálogo central + acervo local      |
| Categorias                 | Select fechado                       | Texto livre                                 | Texto livre vira "Infantil", "infantil", "Inf" e o catálogo bagunça                          |
| Promoção `local → central` | Manual pelo admin                    | Botão automático                            | Frequência baixa; complexidade não compensa                                                  |
| Modo offline               | Fora do MVP                          | Suporte offline com sync                    | MVP precisa primeiro, sync é complexo (conflitos, etc.)                                      |

## Como adicionar nova decisão

Quando uma decisão arquitetural for tomada, adicione uma linha aqui com:

1. **O que foi decidido** (uma linha)
2. **A escolha feita** (a opção vencedora)
3. **As alternativas descartadas** (o que NÃO foi escolhido)
4. **A justificativa** (curta e direta)

Decisões antigas não devem ser removidas — só atualizadas se forem revisadas. O histórico é o valor desse arquivo.
