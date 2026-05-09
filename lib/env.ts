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

const result = schema.safeParse(process.env);
if (!result.success) {
  const variaveis = result.error.issues.map((i) => i.path[0]).join(", ");
  throw new Error(
    `Variáveis de ambiente inválidas ou ausentes: ${variaveis}. Verifique o arquivo .env.`,
  );
}

export const env = result.data;
