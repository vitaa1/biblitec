import { AppError } from "infra/errors";
import { createBookSchema, parseBody } from "infra/schemas";
import book from "models/books";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? undefined;
    const limit = searchParams.get("limit") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const books = await book.findAll({ page, limit, search });
    return Response.json(books);
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(createBookSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const newBook = await book.create(parsed.data);
    return Response.json(newBook, { status: 201 });
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
