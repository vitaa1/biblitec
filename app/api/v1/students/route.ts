import { AppError } from "infra/errors";
import { createLeitorSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { buscar, criar } from "models/leitores";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;
    const leitores = await buscar({ busca }, contexto);
    return Response.json(leitores);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const body = await request.json();
    const parsed = parseBody(createLeitorSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const leitor = await criar(parsed.data, contexto);
    return Response.json(leitor, { status: 201 });
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
