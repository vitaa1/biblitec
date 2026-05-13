import { AppError } from "infra/errors";
import { createGirotecaSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criar, listarComContadores } from "models/girotecas";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const lista = await listarComContadores(contexto);
    return Response.json(lista);
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

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json().catch(() => null);
    const parsed = parseBody(createGirotecaSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const giroteca = await criar(parsed.data, contexto);
    return Response.json(giroteca, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    const cause = (error as { cause?: { constraint?: string } }).cause;
    if (cause?.constraint === "girotecas_codigo_unique") {
      return Response.json(
        { error: "Já existe uma giroteca com este código." },
        { status: 409 },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
