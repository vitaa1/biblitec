# CLAUDE.md

Manual para qualquer instância de Claude (Claude Code, Cursor, etc.) que trabalhar neste repositório. Leia este arquivo inteiro antes da primeira ação.

---

## 1. O que é o Biblitec

Sistema web de gestão das **girotecas** (bibliotecas escolares) da Prefeitura Municipal de Teresina, mantido pelo **Núcleo de Tecnologia Educacional (NTHE)** dentro do projeto **Giratech**.

Projeto público, mantido por equipe pequena, que precisa rodar de forma confiável por anos. Sucessor do Biblivre, que foi abandonado por ser complexo demais para o público que opera as girotecas.

Glossário dos termos do domínio em [`docs/glossary.md`](./docs/glossary.md).

---

## 2. Quem usa o sistema (persona)

Toda decisão de UX, naming e fluxo passa pelo filtro: _"a Maria entenderia isso?"_

**Maria, 52 anos, professora readaptada.** Opera o computador da giroteca de manhã. Domina mouse e teclado, usa WhatsApp, mas tem **medo de "quebrar" o sistema** clicando em algo errado. Trabalhou com Biblivre 6 meses e nunca decorou os menus.

Implicações práticas:

- Telas com muitos campos opcionais paralisam — máximo 3-5 campos visíveis, resto em "Mais opções" recolhível.
- Termos técnicos travam — "Confirmar empréstimo", não "Submeter".
- Mensagens de erro genéricas paralisam — "Erro ao processar" → "Este livro está com a Ana Lúcia, da turma 5A, desde 12/03".
- Confirmação dupla em ações destrutivas. Botões grandes e descritivos.
- Após cada ação, mensagem de sucesso visível e foco já no próximo campo.

Quando estiver em dúvida sobre UI: _"a Maria, sozinha, sem ninguém pra ajudar, conseguiria fazer isso na primeira tentativa?"_ Se "talvez" ou "depois que ela aprender" — está errado.

---

## 3. Escopo: dentro e fora do MVP

**Dentro:** login, catálogo, exemplares, leitores, empréstimo/devolução/renovação, listagem de em aberto/atrasados, indicador básico de atrasados na home.

**Fora (responda "fica para v1.1" e abra issue `pos-mvp`):** reservas, notificações por SMS/email, catálogo público para alunos, multas, importação em massa, dashboards com gráficos, modo offline, app mobile, leitura por câmera, integração com sistema acadêmico.

Decisões de produto importantes (livro perdido, danificado, sem internet, etc.) em [`docs/product-decisions.md`](./docs/product-decisions.md).

---

## 4. Stack

- **Next.js 15** (App Router) + **TypeScript** estrito + **React 19**
- **PostgreSQL 16** + **Drizzle ORM** + drizzle-kit
- **Tailwind CSS 4** + **shadcn/ui**
- **JWT** (cookie httpOnly) + **bcryptjs**
- **Jest** + Testing Library + supertest
- **Docker Compose** local

Não troque nada disso sem abrir issue para discutir. Justificativas e alternativas descartadas em [`docs/decisions.md`](./docs/decisions.md).

---

## 5. Estrutura e camadas

```
biblitec/
├── app/             # páginas (App Router) e API routes
├── components/      # ui/ (shadcn) + feature/ (domínio)
├── db/              # schema, migrations, seeds
├── lib/             # env, auth, utils
├── models/          # ⚠ camada de domínio
├── tests/           # integration + unit
└── middleware.ts    # proteção de rotas
```

**Regra de dependência (sentido único):**

```
componentes → server actions / API routes → models/ → db/
```

- Componentes nunca importam `db/` direto. Sempre via `models/`.
- `models/` nunca importa de `app/` ou `components/`.
- Validação Zod no boundary (Server Action / API route) antes de chamar `models/`.
- Autorização vive em `models/`, não na UI. Esconder botão não é segurança.

Detalhes da camada `models/` (assinatura padrão `(input, contexto)`) em [`docs/architecture.md`](./docs/architecture.md).

---

## 6. Modelo de dados — o essencial

`livros` é o **catálogo bibliográfico** (compartilhado entre todas as girotecas). `exemplares` são **cópias físicas** (cada uma pertence a uma giroteca, com `codigo_tombamento` único por giroteca).

Multi-tenancy é **filtro por `giroteca_id`** (não schemas separados). Em queries de `exemplares`, `leitores`, `emprestimos`: sempre filtrar por giroteca quando `contexto.papel !== 'admin_nthe'`.

Soft delete em tudo. **`emprestimos` nunca deleta — histórico é sagrado.**

Diagrama completo, regras de empréstimo (3 abertos, 14 dias, 2 renovações), estados do exemplar e detalhes de migrations em [`docs/data-model.md`](./docs/data-model.md).

---

## 7. Segurança — o erro mais provável

**Toda query em `exemplares`, `leitores` ou `emprestimos` precisa filtrar por `giroteca_id` quando o usuário não é admin.** Esse é o erro de segurança que você tem mais chance de cometer.

Padrão correto:

```typescript
export async function listarLeitores(contexto: Contexto) {
  const baseQuery = db.select().from(leitores);
  if (contexto.papel === "admin_nthe") return baseQuery;
  return baseQuery.where(eq(leitores.girotecaId, contexto.girotecaId));
}
```

Antes de fechar PR que toca em queries, verifique:

- [ ] Essa query precisa de filtro por giroteca? Tem?
- [ ] Tem teste cobrindo "gestor de A não vê dado de B"?

Outros pontos de segurança (PII de menores/LGPD, autenticação, injection) em [`docs/security.md`](./docs/security.md).

---

## 8. Idioma e convenções

Mistura deliberada: **código em inglês, domínio em português**. Nomes de tabelas e colunas seguem o vocabulário do negócio (`livros`, `exemplares`, `codigo_tombamento`) — traduzir gera ambiguidade.

```typescript
export async function listarEmprestimosAtivos(girotecaId: string) {
  return db
    .select()
    .from(emprestimos)
    .where(
      and(
        eq(emprestimos.girotecaId, girotecaId),
        isNull(emprestimos.dataDevolucao),
      ),
    );
}
```

UI sempre em português. Mensagens de erro humanas, sem stack traces ou códigos HTTP.

Convenções completas (naming, datas, commits, filosofia de código) em [`docs/conventions.md`](./docs/conventions.md).

---

## 9. Comandos essenciais

```bash
npm run dev              # sobe Postgres + Next dev
npm run db:generate      # gera migration a partir do schema
npm run db:migrate       # aplica migrations
npm run db:seed          # popula dados iniciais
npm run db:studio        # abre Drizzle Studio
npm run lint:check
npm run typecheck
npm test
```

Antes de declarar qualquer tarefa pronta:

```bash
npm run lint:check && npm run typecheck && npm test
```

---

## 10. Workflow

1. Issue existe (ou crie). Sem issue, sem branch.
2. `git checkout -b feat/issue-NNN-descricao`
3. Commits atômicos com Conventional Commits em português (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
4. PR draft cedo, "ready" quando funcional + testes passando.
5. Merge após CI verde.

PR description foca em **problema + solução**, não em código (o diff já mostra). Template e detalhes em [`docs/workflow.md`](./docs/workflow.md).

**Não faça sem perguntar:**

- Migrations destrutivas (`DROP`, `TRUNCATE`) em ambiente não-efêmero
- Force push em `main` ou em branch alheia
- Adicionar dependência sem justificar
- Trocar a stack acordada (seção 4)

---

## 11. Em dúvida

1. Este arquivo
2. Pasta [`docs/`](./docs/) — detalhamentos por tema
3. Código existente — procure padrão similar
4. **Pergunte ao humano.** Pergunta clara > tentativa que vira retrabalho.
