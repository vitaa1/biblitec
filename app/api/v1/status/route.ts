import database from "infra/database";
import { env } from "lib/env";

export async function GET() {
  const updatedAt = new Date().toISOString();
  const databaseName = env.POSTGRES_DB;

  const client = await database.getNewClient();

  try {
    const result = await client.query({
      text: `
        SELECT
          version(),
          current_setting('max_connections')::int AS max_connections,
          count(*)::int AS opened_connections
        FROM pg_stat_activity
        WHERE datname = $1
      `,
      values: [databaseName],
    });

    const { version, max_connections, opened_connections } = result.rows[0];
    const versionFormated = version.split(" ")[1];

    return Response.json({
      updated_at: updatedAt,
      dependencies: {
        database: {
          version: versionFormated,
          max_connections,
          opened_connections,
        },
      },
    });
  } finally {
    await client.end();
  }
}
