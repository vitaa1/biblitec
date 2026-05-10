import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { exemplares, girotecas, livros, usuarios } from "./schema";

const SENHA_DEV = "biblitec@dev";

// ─── Dados ────────────────────────────────────────────────────────────────────

const GIROTECAS = [
  {
    codigo: "ESC001",
    nome: "Giroteca Escola Municipal João XXIII",
    escolaVinculada: "Escola Municipal João XXIII",
    endereco: "Rua das Flores, 100 — Teresina/PI",
  },
  {
    codigo: "ESC002",
    nome: "Giroteca Escola Municipal Santos Dumont",
    escolaVinculada: "Escola Municipal Santos Dumont",
    endereco: "Av. Santos Dumont, 200 — Teresina/PI",
  },
] as const;

const LIVROS_PROVISORIOS = [
  {
    titulo: "O Menino Maluquinho",
    autores: "Ziraldo",
    categoria: "Infantil" as const,
    isbn: "9788508030088",
  },
  {
    titulo: "Chapeuzinho Vermelho",
    autores: "Irmãos Grimm",
    categoria: "Infantil" as const,
    isbn: "9788574063577",
  },
  {
    titulo: "A Turma da Mônica",
    autores: "Mauricio de Sousa",
    categoria: "Infantil" as const,
    isbn: "9788539413270",
  },
  {
    titulo: "A Moreninha",
    autores: "Joaquim Manuel de Macedo",
    categoria: "Juvenil" as const,
    isbn: "9788508183449",
  },
  {
    titulo: "O Pequeno Príncipe",
    autores: "Antoine de Saint-Exupéry",
    categoria: "Juvenil" as const,
    isbn: "9788594540379",
  },
  {
    titulo: "Dom Casmurro",
    autores: "Machado de Assis",
    categoria: "Literatura" as const,
    isbn: "9788535910663",
  },
  {
    titulo: "Vidas Secas",
    autores: "Graciliano Ramos",
    categoria: "Literatura" as const,
    isbn: "9788520927064",
  },
  {
    titulo: "O Cortiço",
    autores: "Aluísio Azevedo",
    categoria: "Literatura" as const,
    isbn: "9788508177059",
  },
  {
    titulo: "Português: Língua e Cultura",
    autores: "Autores diversos",
    categoria: "Didático" as const,
    isbn: "9788572082648",
  },
  {
    titulo: "Matemática Essencial",
    autores: "Autores diversos",
    categoria: "Didático" as const,
    isbn: "9788578980672",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tombamento(codigoGiroteca: string, n: number): string {
  return `${codigoGiroteca}-${String(n).padStart(3, "0")}`;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Iniciando seed...\n");

  const senhaHash = await bcrypt.hash(SENHA_DEV, 10);

  // 1. Girotecas
  console.log("→ Girotecas");
  for (const g of GIROTECAS) {
    await db.insert(girotecas).values(g).onConflictDoNothing();
  }
  const [giroteca1] = await db
    .select()
    .from(girotecas)
    .where(eq(girotecas.codigo, "ESC001"));
  const [giroteca2] = await db
    .select()
    .from(girotecas)
    .where(eq(girotecas.codigo, "ESC002"));

  if (!giroteca1 || !giroteca2) {
    throw new Error(
      "Falha ao recuperar girotecas após insert — seed abortado.",
    );
  }

  // 2. Usuários
  console.log("→ Usuários");
  await db
    .insert(usuarios)
    .values({
      nome: "Admin NTHE",
      email: "admin@nthe.teresina.pi.gov.br",
      senhaHash,
      papel: "admin_nthe",
    })
    .onConflictDoNothing();

  await db
    .insert(usuarios)
    .values({
      nome: "Gestor João XXIII",
      email: "gestor.esc001@teresina.pi.gov.br",
      senhaHash,
      papel: "gestor_giroteca",
      girotecaId: giroteca1.id,
    })
    .onConflictDoNothing();

  await db
    .insert(usuarios)
    .values({
      nome: "Gestor Santos Dumont",
      email: "gestor.esc002@teresina.pi.gov.br",
      senhaHash,
      papel: "gestor_giroteca",
      girotecaId: giroteca2.id,
    })
    .onConflictDoNothing();

  // 3. Livros
  console.log("→ Livros");
  for (const livro of LIVROS_PROVISORIOS) {
    await db
      .insert(livros)
      .values({ ...livro, origem: "central" })
      .onConflictDoNothing();
  }
  const livrosInseridos = await db
    .select({ id: livros.id, isbn: livros.isbn })
    .from(livros)
    .where(eq(livros.origem, "central"));

  // 4. Exemplares (2 por livro por giroteca)
  console.log("→ Exemplares");
  let contadorEsc001 = 1;
  let contadorEsc002 = 1;

  for (const livro of livrosInseridos) {
    // 2 exemplares na giroteca 1
    for (let i = 0; i < 2; i++) {
      await db
        .insert(exemplares)
        .values({
          livroId: livro.id,
          girotecaId: giroteca1.id,
          codigoTombamento: tombamento("ESC001", contadorEsc001++),
          estado: "bom",
          status: "disponivel",
        })
        .onConflictDoNothing();
    }
    // 2 exemplares na giroteca 2
    for (let i = 0; i < 2; i++) {
      await db
        .insert(exemplares)
        .values({
          livroId: livro.id,
          girotecaId: giroteca2.id,
          codigoTombamento: tombamento("ESC002", contadorEsc002++),
          estado: "bom",
          status: "disponivel",
        })
        .onConflictDoNothing();
    }
  }

  console.log("\n✅ Seed concluído.");
  console.log("   Girotecas: 2");
  console.log("   Usuários: 3 (1 admin + 2 gestores)");
  console.log(`   Livros: ${livrosInseridos.length}`);
  console.log(
    `   Exemplares: ${livrosInseridos.length * 4} (2 por livro por giroteca)`,
  );
  console.log("\n   Credenciais de dev:");
  console.log("   admin@nthe.teresina.pi.gov.br  |  biblitec@dev");
  console.log("   gestor.esc001@teresina.pi.gov.br  |  biblitec@dev");
  console.log("   gestor.esc002@teresina.pi.gov.br  |  biblitec@dev");

  // força encerramento do pool de conexões do Drizzle
  process.exit(0);
}

seed().catch((err) => {
  console.error("Erro no seed:", err);
  process.exit(1);
});
