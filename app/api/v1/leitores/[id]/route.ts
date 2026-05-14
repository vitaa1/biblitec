import { AppError } from "infra/errors";
import { updateLeitorSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { atualizar } from "models/leitores";

type Params = Promise<{ id: string }>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    const parsed = parseBody(updateLeitorSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const leitor = await atualizar(id, parsed.data, contexto);
    return Response.json(leitor);
  } catch (error) {
    if (error instanceof AppError) {
      const resp: Record<string, string> = { error: error.message };
      if (error.code) resp.code = error.code;
      return Response.json(resp, { status: error.status_code });
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
