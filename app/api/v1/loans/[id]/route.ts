import loan from "models/loans";
import { type NextRequest } from "next/server";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const returned = await loan.returnBook(id);
    return Response.json(returned);
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}
