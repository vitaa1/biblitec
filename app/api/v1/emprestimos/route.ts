import { AppError } from "infra/errors";
import { contextoFromRequest } from "lib/contexto";
import {
  listarComFiltros,
  listarHistorico,
} from "models/emprestimos";

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const { searchParams } = new URL(request.url);
    const aba = searchParams.get("aba");
    const busca = searchParams.get("busca") ?? undefined;
    const turma = searchParams.get("turma") ?? undefined;
    const page = Number(searchParams.get("page") ?? "1");

    if (!aba) {
      return Response.json({ error: "Parâmetro 'aba' é obrigatório." }, { status: 400 });
    }

    if (aba === "em_aberto" || aba === "atrasados") {
      const resultado = await listarComFiltros(
        { aba, busca, turma, page },
        contexto,
      );
      return Response.json(resultado);
    }

    if (aba === "historico") {
      const resultado = await listarHistorico({ busca, turma, page }, contexto);
      return Response.json(resultado);
    }

    return Response.json({ error: "Valor inválido para 'aba'." }, { status: 400 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({ error: error.message }, { status: error.status_code });
    }
    console.error(error);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
