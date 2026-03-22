import pg from "pg";

const { Pool, Client } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: getSSlValues(),
});

async function query(queryObject) {
  const client = await pool.connect();
  try {
    const result = await client.query(queryObject);
    return result;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    client.release();
  }
}

async function getNewClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: getSSlValues(),
  });
  await client.connect();
  return client;
}

function getSSlValues() {
  if (process.env.POSTGRES_CA) {
    return {
      ca: process.env.POSTGRES_CA,
    };
  }

  return process.env.NODE_ENV === "production" ? true : false;
}

export default {
  query: query,
  getNewClient: getNewClient,
  pool: pool,
};
