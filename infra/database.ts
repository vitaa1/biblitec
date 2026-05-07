import { Client, type QueryConfig, type QueryResult } from "pg";

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
    connectionString: process.env.DATABASE_URL,
    ssl: getSslValues(),
  });
  await client.connect();
  return client;
}

function getSslValues(): boolean | { ca: string } {
  if (process.env.POSTGRES_CA) {
    return { ca: process.env.POSTGRES_CA };
  }
  return process.env.NODE_ENV === "production";
}

export default { query, getNewClient };
