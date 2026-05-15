import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { renovar } from "models/emprestimos";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const emprestimo = await renovar(id, contexto);
    return Response.json(emprestimo);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
