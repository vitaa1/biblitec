import { z } from "zod";

export const createBookSchema = z.object({
  titulo: z
    .string({ error: "Título é obrigatório." })
    .min(1, "Título é obrigatório."),
  autor: z
    .string({ error: "Autor é obrigatório." })
    .min(1, "Autor é obrigatório."),
  isbn: z
    .string({ error: "ISBN é obrigatório." })
    .min(1, "ISBN é obrigatório."),
  ano: z
    .number({ error: "Ano deve ser um número." })
    .int("Ano deve ser um número inteiro.")
    .nullable()
    .optional(),
  quantidade: z
    .number({ error: "Quantidade é obrigatória e deve ser um número." })
    .int("Quantidade deve ser um número inteiro.")
    .positive("Quantidade deve ser maior que zero."),
});

export const updateBookSchema = createBookSchema.partial();

export const createStudentSchema = z.object({
  nome: z
    .string({ error: "Nome é obrigatório." })
    .min(1, "Nome é obrigatório."),
  matricula: z
    .string({ error: "Matrícula é obrigatória." })
    .min(1, "Matrícula é obrigatória."),
});

export const createLoanSchema = z.object({
  leitor_id: z.uuid({ error: "leitor_id deve ser um UUID válido." }),
  livro_id: z.uuid({ error: "livro_id deve ser um UUID válido." }),
  dias_prazo: z
    .number({ error: "dias_prazo é obrigatório e deve ser um número." })
    .int("dias_prazo deve ser um número inteiro.")
    .positive("dias_prazo deve ser maior que zero."),
});

export const createUserSchema = z.object({
  nome: z
    .string({ error: "Nome é obrigatório." })
    .min(1, "Nome é obrigatório."),
  email: z.email({ error: "Email inválido." }),
  senha: z
    .string({ error: "Senha é obrigatória." })
    .min(1, "Senha é obrigatória."),
  papel: z
    .enum(["ADMIN", "USER"], { error: "Papel deve ser ADMIN ou USER." })
    .optional(),
});

export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  return { ok: true, data: result.data };
}
