import { AppError } from "infra/errors";
import { createLoanSchema, parseBody } from "infra/schemas";
import loan from "models/loans";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? undefined;
    const limit = searchParams.get("limit") ?? undefined;

    const result = await loan.findAll({ page, limit });
    return Response.json(result);
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

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(createLoanSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const newLoan = await loan.borrow(
      userId,
      parsed.data.leitor_id,
      parsed.data.livro_id,
      parsed.data.dias_prazo,
    );
    return Response.json(newLoan, { status: 201 });
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
