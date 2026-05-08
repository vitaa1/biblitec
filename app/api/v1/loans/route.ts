import { AppError } from "infra/errors";
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
    const { student_id, book_id, due_days } = await request.json();

    if (!book_id) {
      return Response.json({ error: "book_id é obrigatório" }, { status: 400 });
    }
    if (!student_id) {
      return Response.json(
        { error: "student_id é obrigatório" },
        { status: 400 },
      );
    }

    const newLoan = await loan.borrow(userId, student_id, book_id, due_days);
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
