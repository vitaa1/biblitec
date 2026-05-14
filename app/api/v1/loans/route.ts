import { AppError } from "infra/errors";
import { createEmprestimoSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criar, listarEmAberto } from "models/emprestimos";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const emprestimos = await listarEmAberto(contexto);
    return Response.json(emprestimos);
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
    const body = await request.json();
    const parsed = parseBody(createEmprestimoSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const emprestimo = await criar(parsed.data, contexto);
    return Response.json(emprestimo, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      const resp: Record<string, string> = { error: error.message };
      if (error.code) resp.code = error.code;
      return Response.json(resp, { status: error.status_code });
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
