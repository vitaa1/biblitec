import { db } from "db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "node:path";
import { sql } from "drizzle-orm";

const migrationsFolder = join(process.cwd(), "db", "migrations");

export async function GET() {
  try {
    const result = await db.execute(
      sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC`,
    );
    return Response.json(result.rows);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Erro ao listar migrations." },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    await migrate(db, { migrationsFolder });
    return Response.json({ message: "Migrations aplicadas com sucesso." });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
