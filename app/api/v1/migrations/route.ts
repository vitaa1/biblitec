import database from "infra/database";
import migrationRunner from "node-pg-migrate";
import { join } from "node:path";

const migrationOptions = {
  databaseUrl: process.env.DATABASE_URL as string,
  dryRun: true,
  dir: join("infra", "migrations"),
  direction: "up" as const,
  verbose: true,
  migrationsTable: "pgmigrations",
};

export async function GET() {
  let dbClient;
  try {
    dbClient = await database.getNewClient();
    const pendingMigrations = await migrationRunner({
      ...migrationOptions,
      dbClient,
    });
    return Response.json(pendingMigrations);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  } finally {
    if (dbClient) await dbClient.end();
  }
}

export async function POST() {
  let dbClient;
  try {
    dbClient = await database.getNewClient();
    const migratedMigrations = await migrationRunner({
      ...migrationOptions,
      dbClient,
      dryRun: false,
    });

    return Response.json(
      migratedMigrations,
      { status: migratedMigrations.length > 0 ? 201 : 200 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  } finally {
    if (dbClient) await dbClient.end();
  }
}
