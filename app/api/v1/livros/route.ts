import { z } from "zod";
import { AppError } from "infra/errors";
import { createLivroSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { buscarComFiltros, criar, LIVROS_POR_PAGINA } from "models/livros";

const filtrosSchema = z.object({
  q: z.string().min(1).optional(),
  isbn: z
    .string()
    .regex(/^[\d-]{10,17}$/)
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const parsed = filtrosSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos." },
        { status: 400 },
      );
    }
    const { q, isbn, page, limit } = parsed.data;
    const resultado = await buscarComFiltros(
      { q, isbn, page, limit },
      contexto,
    );
    const totalPages = Math.max(
      1,
      Math.ceil(resultado.total / (limit ?? LIVROS_POR_PAGINA)),
    );
    return Response.json({
      livros: resultado.livros,
      total: resultado.total,
      page: page ?? 1,
      totalPages,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createLivroSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const livro = await criar(parsed.data, contexto);
    return Response.json(livro, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
