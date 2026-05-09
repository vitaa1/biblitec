import { Client, type QueryConfig, type QueryResult } from "pg";
import { env } from "lib/env";

async function query(queryObject: QueryConfig): Promise<QueryResult> {
  let client: Client | undefined;
  try {
    client = await getNewClient();
    return await client.query(queryObject);
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    if (client) await client.end();
  }
}

async function getNewClient(): Promise<Client> {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: getSslValues(),
  });
  await client.connect();
  return client;
}

function getSslValues(): boolean | { ca: string } {
  if (env.POSTGRES_CA) {
    return { ca: env.POSTGRES_CA };
  }
  return env.NODE_ENV === "production";
}

const database = { query, getNewClient };
export default database;
