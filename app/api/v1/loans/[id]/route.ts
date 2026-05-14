import { AppError } from "infra/errors";
import { devolverEmprestimoSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { devolver } from "models/emprestimos";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id } = await params;

    let estadoRetorno: "bom" | "regular" | "danificado" | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const rawBody = await request.json().catch(() => ({}));
      const parsed = parseBody(devolverEmprestimoSchema, rawBody);
      if (!parsed.ok) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      estadoRetorno = parsed.data.estadoRetorno;
    }

    const emprestimo = await devolver(id, contexto, { estadoRetorno });
    return Response.json(emprestimo);
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
