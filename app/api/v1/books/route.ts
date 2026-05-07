import book from "models/books";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? undefined;
    const limit = searchParams.get("limit") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const books = await book.findAll({ page, limit, search });
    return Response.json(books);
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { title, author, isbn, year, quantity } = await request.json();
    const newBook = await book.create({ title, author, isbn, year, quantity });
    return Response.json(newBook, { status: 201 });
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}
