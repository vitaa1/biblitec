# Segurança

Detalhamento das práticas de segurança. Para a regra principal (filtro `giroteca_id`), veja [`CLAUDE.md`](../CLAUDE.md) seção 7.

## O básico não-negociável

- **Senha hash:** `bcryptjs` custo 10. Nunca log de senha em texto.
- **JWT:** assinado com `JWT_SECRET` (env var, mínimo 32 chars), expira em 8h.
- **Cookie:** `httpOnly`, `secure` em prod, `sameSite: 'lax'`.
- **CSRF:** Server Actions do Next 15 já protegem com origin check. API routes externas validam `Origin`.
- **SQL injection:** Drizzle parametriza tudo. **Nunca interpole string em `sql\`\``** sem o helper `${valor}`.
- **XSS:** React escapa por padrão. **Nunca** use `dangerouslySetInnerHTML` sem sanitizar.

## Autorização — o erro mais provável de você cometer

Toda query em tabelas com `giroteca_id` precisa filtrar por ele quando o usuário não é admin. **Não confie em filtro de UI.**

Padrão correto:

```typescript
export async function listarLeitores(contexto: Contexto) {
  const baseQuery = db.select().from(leitores);
  if (contexto.papel === "admin_nthe") return baseQuery;
  return baseQuery.where(eq(leitores.girotecaId, contexto.girotecaId));
}
```

Antes de fechar PR que toca em queries:

- [ ] Essa query precisa de filtro por giroteca? Tem?
- [ ] Tem teste cobrindo "gestor de A não vê dado de B"?

Tabelas que SEMPRE precisam de filtro: `exemplares`, `leitores`, `emprestimos`. Tabelas globais (sem filtro): `livros`, `girotecas` (admin), `usuarios` (admin).

## PII — dados de menores e LGPD

Nomes de leitores (alunos), telefones e nomes de responsáveis são dados pessoais sensíveis. Especialmente porque há **menores** envolvidos. Regras:

- Nunca log de nome ou telefone de leitor.
- Nunca expor leitor em URL (`/leitores/maria-silva` ❌, `/leitores/[uuid]` ✅).
- Não enviar dados de leitor para serviços externos (Sentry, analytics) sem sanitização explícita.
- Campos de leitor não aparecem em mensagens de erro expostas ao front sem necessidade.

## Autenticação em ambiente compartilhado

As girotecas usam computadores compartilhados em escolas. Implicações:

- Token expira em 8h (turno de trabalho), não dias ou semanas.
- Logout limpa cookie completamente.
- Rate limiting em `POST /api/v1/sessoes`: máximo 5 tentativas/min por IP.
- Mensagem de erro de login genérica ("Email ou senha incorretos") — sem revelar qual dos dois está errado.
- Sem "lembrar de mim" — exige login a cada sessão.
