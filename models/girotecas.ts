import { eq, sql } from "drizzle-orm";
import { db } from "db/index";
import { girotecas } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Giroteca = typeof girotecas.$inferSelect;

export type GirotecaComContadores = Giroteca & {
  totalExemplares: number;
  totalLeitores: number;
  totalEmprestimosAbertos: number;
};

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

export async function listarComContadores(
  contexto: Contexto,
): Promise<GirotecaComContadores[]> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }

  const rows = await db
    .select({
      id: girotecas.id,
      nome: girotecas.nome,
      codigo: girotecas.codigo,
      escolaVinculada: girotecas.escolaVinculada,
      endereco: girotecas.endereco,
      ativa: girotecas.ativa,
      criadoEm: girotecas.criadoEm,
      totalExemplares: sql<number>`(
        SELECT COUNT(*) FROM exemplares e
        WHERE e.giroteca_id = girotecas.id
      )`.mapWith(Number),
      totalLeitores: sql<number>`(
        SELECT COUNT(*) FROM leitores l
        WHERE l.giroteca_id = girotecas.id
        AND l.ativo = true
      )`.mapWith(Number),
      totalEmprestimosAbertos: sql<number>`(
        SELECT COUNT(*) FROM emprestimos em
        JOIN exemplares ex ON ex.id = em.exemplar_id
        WHERE ex.giroteca_id = girotecas.id
        AND em.data_devolucao IS NULL
      )`.mapWith(Number),
    })
    .from(girotecas)
    .orderBy(girotecas.nome);

  return rows;
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
