import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { atualizar } from "models/girotecas";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const giroteca = await atualizar(id, { ativa: false }, contexto);
    return Response.json(giroteca);
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
