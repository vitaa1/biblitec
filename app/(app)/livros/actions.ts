"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criar, atualizar } from "models/livros";
import { contextoFromServerComponent } from "lib/contexto";
import { AppError } from "infra/errors";
import type { LivroFormState } from "components/feature/livro-form";

const ANO_MAX = new Date().getFullYear();

const livroSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório."),
  autores: z.string().min(1, "Autores é obrigatório."),
  categoria: z.enum(["Infantil", "Juvenil", "Didático", "Literatura", "Outros"], {
    error: "Selecione uma categoria.",
  }),
  capaUrl: z.string().url("URL inválida.").or(z.literal("")).optional(),
  isbn: z
    .string()
    .regex(/^\d{10}$|^\d{13}$/, "ISBN inválido. Informe 10 ou 13 dígitos.")
    .optional()
    .or(z.literal("")),
  editora: z.string().optional(),
  anoPublicacao: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(
      z
        .number()
        .int()
        .min(1450, `Ano deve ser entre 1450 e ${ANO_MAX}.`)
        .max(ANO_MAX, `Ano deve ser entre 1450 e ${ANO_MAX}.`)
        .optional(),
    ),
  descricao: z.string().optional(),
});

function parseFormData(formData: FormData) {
  return {
    titulo: formData.get("titulo") as string,
    autores: formData.get("autores") as string,
    categoria: formData.get("categoria") as string,
    capaUrl: (formData.get("capaUrl") as string) || undefined,
    isbn: (formData.get("isbn") as string) || undefined,
    editora: (formData.get("editora") as string) || undefined,
    anoPublicacao: (formData.get("anoPublicacao") as string) || undefined,
    descricao: (formData.get("descricao") as string) || undefined,
  };
}

export async function criarLivroAction(
  _prev: LivroFormState,
  formData: FormData,
): Promise<LivroFormState> {
  const parsed = livroSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const dados = parsed.data;

  try {
    const contexto = await contextoFromServerComponent();
    const livro = await criar(
      {
        titulo: dados.titulo,
        autores: dados.autores,
        categoria: dados.categoria,
        capaUrl: dados.capaUrl || undefined,
        isbn: dados.isbn || undefined,
        editora: dados.editora || undefined,
        anoPublicacao: dados.anoPublicacao,
        descricao: dados.descricao || undefined,
      },
      contexto,
    );
    redirect(`/livros/${livro.id}`);
  } catch (err) {
    if (err instanceof AppError) {
      return { errors: { _form: [err.message] } };
    }
    throw err;
  }
}

export async function editarLivroAction(
  id: string,
  _prev: LivroFormState,
  formData: FormData,
): Promise<LivroFormState> {
  const parsed = livroSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const dados = parsed.data;

  try {
    const contexto = await contextoFromServerComponent();
    await atualizar(
      id,
      {
        titulo: dados.titulo,
        autores: dados.autores,
        categoria: dados.categoria,
        capaUrl: dados.capaUrl || undefined,
        isbn: dados.isbn || undefined,
        editora: dados.editora || undefined,
        anoPublicacao: dados.anoPublicacao,
        descricao: dados.descricao || undefined,
      },
      contexto,
    );
    redirect(`/livros/${id}`);
  } catch (err) {
    if (err instanceof AppError) {
      return { errors: { _form: [err.message] } };
    }
    throw err;
  }
}
