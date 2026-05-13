import { AppError } from "infra/errors";
import { baixarExemplarSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { mudarStatus } from "models/exemplares";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(baixarExemplarSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const exemplar = await mudarStatus(
      id,
      "baixado",
      parsed.data.motivo,
      contexto,
    );
    return Response.json(exemplar);
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
