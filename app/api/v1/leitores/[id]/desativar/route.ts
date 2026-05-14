import { AppError } from "infra/errors";
import { UUID_REGEX } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { desativar } from "models/leitores";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
    await desativar(id, contexto);
    return new Response(null, { status: 204 });
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
