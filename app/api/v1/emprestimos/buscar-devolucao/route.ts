import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import { buscarParaDevolucao } from "models/emprestimos";

const CODE_TO_STATUS: Record<string, number> = {
  NAO_ENCONTRADO: 404,
  SEM_EMPRESTIMO_ABERTO: 404,
  MULTIPLOS_EMPRESTADOS: 409,
  EXEMPLAR_BAIXADO: 404,
};

const CODE_TO_MESSAGE: Record<string, string> = {
  NAO_ENCONTRADO:
    "Nenhum exemplar com esse código foi encontrado nesta giroteca.",
  SEM_EMPRESTIMO_ABERTO: "Este exemplar não está emprestado no momento.",
  MULTIPLOS_EMPRESTADOS:
    "Há mais de um exemplar deste livro emprestado. Use o código de tombamento.",
  EXEMPLAR_BAIXADO: "Este exemplar foi baixado do acervo.",
};

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
    const resultado = await buscarParaDevolucao(q, contexto);
    if (!resultado.ok) {
      const status = CODE_TO_STATUS[resultado.code] ?? 400;
      const error = CODE_TO_MESSAGE[resultado.code] ?? "Erro desconhecido.";
      if (resultado.code === "NAO_ENCONTRADO") {
        return Response.json({ error }, { status });
      }
      return Response.json({ error, code: resultado.code }, { status });
    }
    return Response.json(resultado.data);
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
