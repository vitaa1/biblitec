# Spec: Validação de campos do formulário de Leitor

**Data:** 2026-05-14
**Branch alvo:** feat/issue-53-gestao-leitores

---

## Problema

O `LeitorDialog` não valida nem formata os campos antes de enviar ao servidor. É possível digitar mais dígitos do que o padrão no telefone, enviar campos acima dos limites do banco e não receber feedback imediato de erro por campo.

---

## Solução

Validação em duas camadas: cliente (feedback imediato, máscara de telefone) e servidor (Zod schemas atualizados).

---

## Seção 1 — Máscara de telefone (cliente)

Função `formatarTelefone(valor: string): string` aplicada no `onChange`:

1. Strip de todos os não-dígitos
2. Limita a 11 dígitos
3. Aplica máscara progressiva:
   - 0–2 dígitos: `XX`
   - 3–6: `(XX) XXX`
   - 7–10: `(XX) XXXX-XXXX` (fixo)
   - 11: `(XX) XXXXX-XXXX` (celular)

Campo recebe `inputMode="tel"` para teclado numérico em dispositivos móveis.

Armazenamento: valor formatado (ex: `(86) 99999-0000`), sem transformação antes de salvar.

---

## Seção 2 — Validação de campos no cliente

Erros exibidos inline abaixo de cada campo, ativados **no submit** (não enquanto digita).

Estado unificado `erros: Record<keyof FormState, string | null>` substitui os atuais `erroGeral` e `erroMatricula` separados. O erro de `MATRICULA_DUPLICADA` da API continua sendo mapeado para `erros.matricula`.

| Campo         | Regra                                     | Mensagem de erro                                 |
| ------------- | ----------------------------------------- | ------------------------------------------------ |
| `nome`        | obrigatório, máx 255 chars                | "Nome é obrigatório."                            |
| `matricula`   | máx 50 chars                              | "Matrícula deve ter no máximo 50 caracteres."    |
| `turma`       | máx 100 chars                             | "Turma deve ter no máximo 100 caracteres."       |
| `telefone`    | se preenchido: 10 ou 11 dígitos completos | "Telefone incompleto. Ex: (86) 99999-0000"       |
| `responsavel` | máx 255 chars                             | "Responsável deve ter no máximo 255 caracteres." |

`<Input>` recebe `maxLength` alinhado com o banco em todos os campos para bloqueio físico no browser. O botão de submit fica desabilitado enquanto `Object.values(erros).some(Boolean)`.

---

## Seção 3 — Zod schemas no servidor

Atualizar `createLeitorSchema` e `updateLeitorSchema` em `infra/schemas.ts`:

| Campo         | Regra adicionada                                                  |
| ------------- | ----------------------------------------------------------------- |
| `nome`        | `.max(255)`                                                       |
| `matricula`   | `.max(50)`                                                        |
| `turma`       | `.max(100)`                                                       |
| `telefone`    | `.max(20)` + regex `^\(\d{2}\) \d{4,5}-\d{4}$` (só se preenchido) |
| `responsavel` | `.max(255)`                                                       |

Regex de telefone aceita exatamente o que a máscara produz. Campo continua opcional — regex só valida se o valor existir.

---

## Arquivos afetados

- `app/(app)/leitores/_components/leitor-dialog.tsx` — máscara, estado `erros`, validação no submit
- `infra/schemas.ts` — regras `.max()` e regex de telefone nos dois schemas de leitor

## Fora de escopo

- Validar unicidade de matrícula no cliente (já tratada via API + erro inline)
- Formatação de CPF ou qualquer outro campo além de telefone
- Mudança no schema do banco (varchar lengths já comportam os limites)
