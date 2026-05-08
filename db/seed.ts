import { db } from "./index";
import { livros, leitores, usuarios } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Populando banco de dados...");

  const passwordHash = await bcrypt.hash("senha123", 10);

  await db
    .insert(usuarios)
    .values({
      email: "admin@biblitec.com.br",
      senha: passwordHash,
      nome: "Administrador",
      papel: "ADMIN",
    })
    .onConflictDoNothing();

  await db
    .insert(livros)
    .values([
      {
        titulo: "Dom Casmurro",
        autor: "Machado de Assis",
        isbn: "9788535910663",
        ano: 1899,
        quantidade: 3,
        quantidadeDisponivel: 3,
      },
      {
        titulo: "O Cortiço",
        autor: "Aluísio Azevedo",
        isbn: "9788508177059",
        ano: 1890,
        quantidade: 2,
        quantidadeDisponivel: 2,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(leitores)
    .values([
      { nome: "Ana Lúcia Silva", matricula: "2024001" },
      { nome: "João Pedro Santos", matricula: "2024002" },
    ])
    .onConflictDoNothing();

  console.log("Concluído.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
