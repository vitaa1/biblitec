import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { atualizar } from "models/girotecas";

type Params = Promise<{ id: string }>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
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
