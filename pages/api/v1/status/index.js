import database from "infra/database.js";

async function status(request, response) {
  const updatedAt = new Date().toISOString();
  const databaseName = process.env.POSTGRES_DB;

  const result = await database.query({
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

  response.status(200).json({
    updated_at: updatedAt,
    dependencies: {
      database: {
        version: versionFormated,
        max_connections: max_connections,
        opened_connections: opened_connections,
      },
    },
  });
}

export default status;
