import { AppError } from "infra/errors";
import { updateLivroSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { atualizar, buscarPorId, remover } from "models/livros";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const livro = await buscarPorId(id);
    if (!livro) {
      return Response.json(
        { error: "Livro não encontrado." },
        { status: 404 },
      );
    }
    return Response.json(livro);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(updateLivroSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const livro = await atualizar(id, parsed.data, contexto);
    return Response.json(livro);
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

export async function DELETE(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    await remover(id, contexto);
    return new Response(null, { status: 204 });
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
