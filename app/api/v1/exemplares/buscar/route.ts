import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { buscarParaEmprestimo } from "models/exemplares";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || !q.trim()) {
      return Response.json(
        { error: "Parâmetro 'q' é obrigatório." },
        { status: 400 },
      );
    }
    const resultado = await buscarParaEmprestimo(q, contexto);
    if (!resultado) {
      return Response.json(
        { error: "Exemplar não encontrado." },
        { status: 404 },
      );
    }
    return Response.json(resultado);
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
