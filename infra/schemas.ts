import { z } from "zod";

export const categoriaLivroSchema = z.enum([
  "Infantil",
  "Juvenil",
  "Didático",
  "Literatura",
  "Outros",
]);

export const createLivroSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório."),
  autores: z.string().min(1, "Autores é obrigatório."),
  isbn: z.string().optional(),
  editora: z.string().optional(),
  anoPublicacao: z.number().int().positive().optional(),
  categoria: categoriaLivroSchema.optional(),
  capaUrl: z.string().optional(),
});

export const updateLivroSchema = createLivroSchema.partial();

export const createLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  matricula: z.string().min(1, "Matrícula é obrigatória."),
  girotecaId: z.uuid("girotecaId deve ser um UUID válido."),
  turma: z.string().optional(),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  telefone: z.string().optional(),
  responsavel: z.string().optional(),
});

export const createEmprestimoSchema = z.object({
  exemplarId: z.uuid("exemplarId deve ser um UUID válido."),
  leitorId: z.uuid("leitorId deve ser um UUID válido."),
  observacoes: z.string().optional(),
});

export const createUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  email: z.email("Email inválido."),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  papel: z.enum(["admin_nthe", "gestor_giroteca"]),
  girotecaId: z.uuid().optional(),
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
