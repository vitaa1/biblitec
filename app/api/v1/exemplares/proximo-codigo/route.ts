import { z } from "zod";
import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { sugerirProximoCodigo } from "models/exemplares";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const girotecaId = searchParams.get("girotecaId") ?? contexto.girotecaId;

    if (!girotecaId) {
      return Response.json(
        { error: "girotecaId é obrigatório." },
        { status: 400 },
      );
    }

    if (!z.string().uuid().safeParse(girotecaId).success) {
      return Response.json({ error: "girotecaId inválido." }, { status: 400 });
    }

    const proximo = await sugerirProximoCodigo(girotecaId, contexto);
    return Response.json({ proximo });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
