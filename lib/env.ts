import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_CA: z.string().optional(),
});

export const env = schema.parse(process.env);
