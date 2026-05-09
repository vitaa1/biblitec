import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "lib/env";
import * as schema from "./schema";

function getSsl(): boolean | { ca: string } | undefined {
  if (env.POSTGRES_CA) return { ca: env.POSTGRES_CA };
  if (env.NODE_ENV === "production") return true;
  return undefined;
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: getSsl(),
});

export const db = drizzle(pool, { schema });
