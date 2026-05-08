import { AppError } from "infra/errors";
import { updateBookSchema, parseBody } from "infra/schemas";
import book from "models/books";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const found = await book.findOneById(id);
    if (!found) {
      return Response.json({ error: "Livro não encontrado" }, { status: 404 });
    }
    return Response.json(found);
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
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(updateBookSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const updated = await book.update(id, parsed.data);
    return Response.json(updated);
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

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    await book.remove(id);
    return new Response(null, { status: 204 });
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
