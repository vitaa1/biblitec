import { AppError } from "infra/errors";
import { createStudentSchema, parseBody } from "infra/schemas";
import student from "models/students";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const students = await student.findAll();
    return Response.json(students);
  } catch {
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
    const parsed = parseBody(createStudentSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const newStudent = await student.create(parsed.data);
    return Response.json(newStudent, { status: 201 });
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
