import { AppError } from "infra/errors";
import { createExemplarSchema, parseBody } from "infra/schemas";
import { contextoFromRequest } from "lib/contexto";
import { criarParaGiroteca, listarPorLivroNaGiroteca } from "models/exemplares";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id: livroId } = await params;
    const lista = await listarPorLivroNaGiroteca(livroId, contexto);
    return Response.json(lista);
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

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const contexto = contextoFromRequest(request);
    const { id: livroId } = await params;

    if (!contexto.girotecaId) {
      return Response.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseBody(createExemplarSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const exemplar = await criarParaGiroteca(
      {
        livroId,
        girotecaId: contexto.girotecaId,
        codigoTombamento: parsed.data.codigoTombamento,
        estado: parsed.data.estado,
        observacoes: parsed.data.observacoes,
      },
      contexto,
    );
    return Response.json(exemplar, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    const cause = (error as { cause?: { constraint?: string } }).cause;
    if (cause?.constraint === "exemplares_tombamento_giroteca_idx") {
      return Response.json(
        { error: "Já existe um exemplar com este código nesta giroteca." },
        { status: 409 },
      );
    }
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
