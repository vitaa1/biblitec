import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { renovarEmprestimo } from "models/emprestimos";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const emprestimo = await renovarEmprestimo({ emprestimoId: id }, contexto);
    return Response.json(emprestimo);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { code: error.code ?? null, message: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { code: null, message: "Erro interno." },
      { status: 500 },
    );
  }
}
