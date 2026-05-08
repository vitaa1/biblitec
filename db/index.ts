import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function getSsl(): boolean | { ca: string } | undefined {
  if (process.env.POSTGRES_CA) return { ca: process.env.POSTGRES_CA };
  if (process.env.NODE_ENV === "production") return true;
  return undefined;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSsl(),
});

export const db = drizzle(pool, { schema });
