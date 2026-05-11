import { AppError } from "infra/errors";
import { createUsuarioSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criar } from "models/usuarios";

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createUsuarioSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const usuario = await criar(parsed.data, contexto);
    return Response.json(usuario, { status: 201 });
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
