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
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { name, registration } = await request.json();
    const newStudent = await student.create({ name, registration });
    return Response.json(newStudent, { status: 201 });
  } catch (error: any) {
    const status = error.status_code ?? 500;
    return Response.json({ error: error.message }, { status });
  }
}
