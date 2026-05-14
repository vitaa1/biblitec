import { z } from "zod";

export const TELEFONE_REGEX = /^\(\d{2}\) \d{4,5}-\d{4}$/;

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
  isbn: z
    .string()
    .regex(/^\d{10}$|^\d{13}$/, "ISBN inválido. Informe 10 ou 13 dígitos.")
    .optional(),
  editora: z.string().optional(),
  anoPublicacao: z.number().int().positive().optional(),
  categoria: categoriaLivroSchema,
  capaUrl: z.string().optional(),
  descricao: z.string().optional(),
});

export const updateLivroSchema = createLivroSchema.partial();

export const createLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório.").max(255),
  girotecaId: z.uuid("girotecaId deve ser um UUID válido."),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  matricula: z
    .string()
    .max(50, "Matrícula deve ter no máximo 50 caracteres.")
    .optional(),
  turma: z
    .string()
    .max(100, "Turma deve ter no máximo 100 caracteres.")
    .optional(),
  telefone: z
    .string()
    .regex(TELEFONE_REGEX, "Formato inválido. Use (XX) XXXXX-XXXX.")
    .optional(),
  responsavel: z
    .string()
    .max(255, "Responsável deve ter no máximo 255 caracteres.")
    .optional(),
});

export const updateLeitorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório.").max(255).optional(),
  tipo: z.enum(["aluno", "professor", "funcionario"]).optional(),
  matricula: z
    .string()
    .max(50, "Matrícula deve ter no máximo 50 caracteres.")
    .optional()
    .nullable(),
  turma: z
    .string()
    .max(100, "Turma deve ter no máximo 100 caracteres.")
    .optional()
    .nullable(),
  telefone: z
    .string()
    .regex(TELEFONE_REGEX, "Formato inválido. Use (XX) XXXXX-XXXX.")
    .optional()
    .nullable(),
  responsavel: z
    .string()
    .max(255, "Responsável deve ter no máximo 255 caracteres.")
    .optional()
    .nullable(),
});

export const createEmprestimoSchema = z.object({
  exemplarId: z.uuid("exemplarId deve ser um UUID válido."),
  leitorId: z.uuid("leitorId deve ser um UUID válido."),
  observacoes: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório."),
  senha: z.string().min(1, "Senha é obrigatória."),
});

export const createUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  email: z.email("Email inválido."),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  papel: z.enum(["admin_nthe", "gestor_giroteca"]),
  girotecaId: z.uuid("girotecaId deve ser um UUID válido.").optional(),
});

export const createExemplarSchema = z.object({
  codigoTombamento: z
    .string()
    .min(1, "Código de tombamento é obrigatório.")
    .max(50, "Código de tombamento deve ter no máximo 50 caracteres."),
  estado: z.enum(["novo", "bom", "regular", "danificado"]).optional(),
  observacoes: z.string().optional(),
});

export const baixarExemplarSchema = z.object({
  motivo: z.enum(["Perdido", "Danificado", "Descartado", "Outro"], {
    error: "Selecione um motivo.",
  }),
});

export const createGirotecaSchema = z.object({
  codigo: z
    .string()
    .min(1, "Código é obrigatório.")
    .max(50, "Código deve ter no máximo 50 caracteres."),
  nome: z
    .string()
    .min(1, "Nome é obrigatório.")
    .max(255, "Nome deve ter no máximo 255 caracteres."),
  escolaVinculada: z
    .string()
    .min(1, "Escola vinculada é obrigatória.")
    .max(255, "Escola vinculada deve ter no máximo 255 caracteres."),
  endereco: z.string().optional(),
});

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
