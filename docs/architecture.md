# Arquitetura

Detalhamento da arquitetura do Biblitec. Para o resumo (estrutura + camadas), veja [`CLAUDE.md`](../CLAUDE.md) seção 5.

## Estrutura de pastas

```
biblitec/
├── app/                      # Páginas e API routes (App Router)
│   ├── (auth)/login/        # Rotas públicas em route group
│   ├── (app)/               # Rotas autenticadas
│   │   ├── livros/
│   │   ├── leitores/
│   │   ├── emprestimos/
│   │   └── devolucoes/
│   ├── admin/               # Apenas papel admin_nte
│   └── api/v1/              # API REST versionada
├── components/
│   ├── ui/                  # shadcn/ui (não editar manualmente)
│   └── feature/             # Componentes específicos do domínio
├── db/
│   ├── schema.ts            # Schema Drizzle único, ordem importa
│   ├── migrations/          # Geradas por drizzle-kit, NÃO editar
│   ├── seed.ts              # Dados iniciais
│   └── index.ts             # Cliente compartilhado
├── lib/
│   ├── env.ts               # Validação Zod das env vars
│   ├── auth.ts              # JWT, bcrypt, sessão
│   └── utils.ts             # cn(), formatters de data, etc.
├── models/                  # ⚠ Camada de domínio
│   ├── livros.ts
│   ├── exemplares.ts
│   ├── emprestimos.ts
│   ├── leitores.ts
│   ├── girotecas.ts
│   └── usuarios.ts
├── infra/
│   └── compose.yaml
├── tests/
│   ├── integration/         # Contra banco real
│   └── unit/                # Funções puras
└── middleware.ts            # Proteção de rotas + tenant resolution
```

## Camadas e regras de dependência

```
Componentes (UI)  →  Server Actions / API Routes  →  models/  →  db/
```

Sentido único, sem ciclos:

- Componentes nunca chamam `db/` direto. Sempre via `models/`.
- `models/` nunca importa de `app/` ou `components/`.
- Validação de input com Zod no boundary (Server Action ou API route) antes de chamar `models/`.
- Autorização vive em `models/`, não na UI. Esconder um botão não é segurança.

## A camada `models/` é onde mora o domínio

Cada arquivo em `models/` exporta funções puras de negócio. **Não são classes.**

Padrão:

```typescript
// models/emprestimos.ts
export async function criarEmprestimo(
  input: CriarEmprestimoInput,
  contexto: Contexto,
) {
  // 1. Validar regras de negócio (ex: leitor não pode ter >3 abertos)
  // 2. Verificar autorização (usuário pode operar nessa giroteca?)
  // 3. Executar transação
  // 4. Retornar resultado tipado
}
```

Toda função recebe um **`contexto`** com `usuarioId`, `papel` e `girotecaId` (ou marca `admin_nthe`). **Não confie em filtragem de UI** — toda query precisa filtrar por giroteca quando o usuário não é admin.

Tipo `Contexto` (em `lib/auth.ts`):

```typescript
type Contexto = {
  usuarioId: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null; // null se admin_nthe
};
```

## Testes

O que testar:

- **Sempre:** funções de `models/` (são o domínio).
- **Sempre:** regras de autorização (gestor não vê dados de outra giroteca).
- **Sempre:** fluxos end-to-end críticos: criar empréstimo, devolver, renovar.
- **Quando útil:** componentes complexos com lógica.
- **Não:** getters/setters triviais, componentes puramente apresentacionais.

Como testar:

- Testes de integração sobem Postgres real via Docker.
- Cada teste deve limpar o que criou ou rodar em transação revertida.
- `--runInBand` (sequencial) por causa do banco compartilhado.
- Use factories simples (`tests/factories/livro.ts`) em vez de fixtures gigantes.

```typescript
test("gestor da Giroteca A não consegue criar empréstimo na Giroteca B", async () => {
  const gestorA = await criarUsuarioFake({ giroteca: girotecaA });
  const exemplarB = await criarExemplarFake({ giroteca: girotecaB });

  await expect(
    criarEmprestimo(
      { exemplarId: exemplarB.id, ...resto },
      contextoDe(gestorA),
    ),
  ).rejects.toThrow("NAO_AUTORIZADO");
});
```
