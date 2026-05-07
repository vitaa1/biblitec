# Workflow

Detalhamento do workflow de desenvolvimento. Para o resumo, veja [`CLAUDE.md`](../CLAUDE.md) seção 10.

## Antes de codar

1. **Referencie ou crie uma issue.** Sem issue, sem branch.
2. **Identifique a milestone.** Se a tarefa parece estar fora da milestone atual, alerte antes de começar.
3. **Mapeie os arquivos afetados** antes de editar.
4. **Se algo for ambíguo, pergunte.** Errar requisito custa mais que perguntar.

## Git

Nunca commite diretamente em `main`. Sempre use feature branches.

Nomenclatura de branches:

```
feat/issue-42-tela-emprestimo
fix/issue-38-calculo-atraso
refactor/issue-51-extrair-validacao
chore/atualiza-dependencias
docs/atualiza-readme
```

Fluxo completo:

1. Referencie ou crie issue
2. `git checkout -b feat/issue-NNN-descricao`
3. Commits pequenos e atômicos
4. `git push` e abra PR como **draft** cedo — dá visibilidade sem pressionar review
5. Converta para "Ready for review" quando funcional + testes passando
6. Merge após aprovação e CI verde

## Pull Requests

A descrição do PR foca em **problema e solução**, não em código. O diff já mostra o código.

Template:

```markdown
## Problema

Descreva o que estava faltando ou quebrado. Uma frase é suficiente para tarefas simples.

## Solução

Como foi resolvido em alto nível. Só mencione decisões de código se não forem óbvias.

## Como testar

Passos para o revisor validar manualmente, se aplicável.

Closes #NNN
```

## Codando

- **Mudanças mínimas.** Não refatore arquivos não relacionados na mesma PR.
- **Não adicione dependência sem justificar.** Cada `npm install` é custo de manutenção.
- **Mantenha cobertura de testes.** Função nova em `models/` sem teste = PR rejeitado.
- **Componente novo?** Use shadcn/ui quando existir variante. Não recrie `Button` do zero.
- **Rode os testes com frequência**, não só no final.

## Antes de declarar pronto

Checklist obrigatório, nesta ordem:

```bash
npm run lint:check && npm run typecheck && npm test
```

- [ ] `npm run lint:check` passa
- [ ] `npm run typecheck` passa
- [ ] `npm test` passa
- [ ] Se mudou schema: rodou `db:generate` e a migration está commitada
- [ ] Se mudou env var: atualizou `.env.example` e `lib/env.ts`
- [ ] Se mudou comportamento de UI: testou no navegador
- [ ] Se tocou em queries com `girotecaId`: verificou autorização e cobriu com teste
- [ ] Mensagens de erro/UI em português, sem jargão técnico
- [ ] Documentação atualizada se a mudança afeta `README.md`, `CLAUDE.md` ou `docs/`

## Resolução de falhas de CI

Quando o CI falhar, corrija nesta ordem:

1. **Formatação** — `npm run lint:fix`
2. **Erros de tipo** — `npm run typecheck`, corrija um por um com contexto completo
3. **Lint** — `npm run lint:check`, corrija os restantes

Erros de tipo mais comuns:

| Erro                                | Solução                                           |
| ----------------------------------- | ------------------------------------------------- |
| `possibly undefined`                | Adicione verificação explícita (`if (!x) return`) |
| `Type 'X' is not assignable to 'Y'` | Verifique assinatura da função em `models/`       |
| Linha muito longa                   | Quebre em múltiplas linhas com parênteses         |

## O que NÃO fazer sem perguntar

- Migrations destrutivas (`DROP`, `TRUNCATE`) em ambiente que não seja efêmero.
- Force push em `main` ou em branch alheia.
- Deletar issues, fechar issue alheia, mexer em milestones sem combinar.
- Subir credencial real (mesmo de dev). `.env*` está no `.gitignore` por uma razão.
- Adicionar dependência por estética ("essa lib é mais moderna").
- Trocar a stack acordada sem discussão prévia em issue.
