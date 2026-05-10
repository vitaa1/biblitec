import { db } from "./index";
import { girotecas, livros, leitores, usuarios } from "./schema";
import bcrypt from "bcryptjs";

// Seed provisório — será reescrito na issue de seed da Milestone 2
async function seed() {
  console.log("Populando banco de dados...");

  const senhaHash = await bcrypt.hash("senha123", 10);

  const [giroteca] = await db
    .insert(girotecas)
    .values({
      nome: "Giroteca Escola Modelo",
      codigo: "GM001",
      escolaVinculada: "Escola Estadual Modelo",
    })
    .onConflictDoNothing()
    .returning();

  if (!giroteca) {
    console.log("Giroteca já existe, pulando seed.");
    process.exit(0);
  }

  await db
    .insert(usuarios)
    .values({
      nome: "Administrador NTHE",
      email: "admin@nthe.teresina.pi.gov.br",
      senhaHash,
      papel: "admin_nthe",
    })
    .onConflictDoNothing();

  await db
    .insert(livros)
    .values([
      {
        titulo: "Dom Casmurro",
        autores: "Machado de Assis",
        isbn: "9788535910663",
        anoPublicacao: 1899,
        origem: "central",
      },
      {
        titulo: "O Cortiço",
        autores: "Aluísio Azevedo",
        isbn: "9788508177059",
        anoPublicacao: 1890,
        origem: "central",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(leitores)
    .values([
      {
        girotecaId: giroteca.id,
        nome: "Ana Lúcia Silva",
        matricula: "2024001",
      },
      {
        girotecaId: giroteca.id,
        nome: "João Pedro Santos",
        matricula: "2024002",
      },
    ])
    .onConflictDoNothing();

  console.log("Concluído.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
