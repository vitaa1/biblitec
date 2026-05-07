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
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { title, author, isbn, year, quantity } = await request.json();
    const updated = await book.update(id, { title, author, isbn, year, quantity });
    return Response.json(updated);
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await book.remove(id);
    return new Response(null, { status: 204 });
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}
