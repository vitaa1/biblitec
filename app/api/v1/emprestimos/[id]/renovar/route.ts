import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { renovarEmprestimo } from "models/emprestimos";

type Params = Promise<{ id: string }>;

const BUSINESS_CODES = new Set(["JA_DEVOLVIDO", "EM_ATRASO", "LIMITE_RENOVACOES"]);

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const emprestimo = await renovarEmprestimo({ emprestimoId: id }, contexto);
    return Response.json(emprestimo);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code && BUSINESS_CODES.has(error.code)) {
        return Response.json(
          { code: error.code, message: error.message },
          { status: error.status_code },
        );
      }
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
