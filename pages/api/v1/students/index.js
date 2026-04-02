import student from "models/students.js";

export default async function students(request, response) {
  const userId = request.headers["x-user-id"];

  if (!userId) {
    return response.status(401).json({ error: "Não autorizado." });
  }

  if (request.method === "GET") {
    try {
      const students = await student.findAll();
      return response.status(200).json(students);
    } catch (error) {
      return response.status(500).json({ error: "Erro interno do servidor." });
    }
  }

  if (request.method === "POST") {
    try {
      const { name, registration } = request.body;
      const newStudent = await student.create({ name, registration });
      return response.status(201).json(newStudent);
    } catch (error) {
      const status = error.status_code ?? 500;
      return response.status(status).json({ error: error.message });
    }
  }

  return response.status(405).end();
}
