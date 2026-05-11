import { eq } from "drizzle-orm";
import { db } from "db/index";
import { girotecas } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Giroteca = typeof girotecas.$inferSelect;

export async function listar(contexto: Contexto): Promise<Giroteca[]> {
  if (contexto.papel === "admin_nthe") {
    return db.select().from(girotecas).orderBy(girotecas.nome);
  }
  return db
    .select()
    .from(girotecas)
    .where(eq(girotecas.id, contexto.girotecaId!));
}

export async function criar(
  input: {
    codigo: string;
    nome: string;
    escolaVinculada: string;
    endereco?: string;
  },
  contexto: Contexto,
): Promise<Giroteca> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }
  const [row] = await db.insert(girotecas).values(input).returning();
  return row;
}

export async function atualizar(
  id: string,
  input: {
    nome?: string;
    escolaVinculada?: string;
    endereco?: string;
    ativa?: boolean;
  },
  contexto: Contexto,
): Promise<Giroteca> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }
  const [row] = await db
    .update(girotecas)
    .set(input)
    .where(eq(girotecas.id, id))
    .returning();
  if (!row) throw new AppError("Giroteca não encontrada.", 404);
  return row;
}
