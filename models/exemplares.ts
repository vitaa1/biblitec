import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Exemplar = typeof exemplares.$inferSelect;
export type ExemplarComLeitor = Exemplar & { nomeLeitor: string | null };

export async function listarPorLivroNaGiroteca(
  livroId: string,
  contexto: Contexto,
): Promise<ExemplarComLeitor[]> {
  const rows = await db
    .select({
      id: exemplares.id,
      livroId: exemplares.livroId,
      girotecaId: exemplares.girotecaId,
      codigoTombamento: exemplares.codigoTombamento,
      estado: exemplares.estado,
      status: exemplares.status,
      observacoes: exemplares.observacoes,
      criadoEm: exemplares.criadoEm,
      atualizadoEm: exemplares.atualizadoEm,
      nomeLeitor: leitores.nome,
    })
    .from(exemplares)
    .leftJoin(
      emprestimos,
      and(
        eq(emprestimos.exemplarId, exemplares.id),
        isNull(emprestimos.dataDevolucao),
      ),
    )
    .leftJoin(leitores, eq(leitores.id, emprestimos.leitorId))
    .where(
      and(
        eq(exemplares.livroId, livroId),
        contexto.papel === "gestor_giroteca"
          ? eq(exemplares.girotecaId, contexto.girotecaId!)
          : undefined,
      ),
    )
    .orderBy(exemplares.codigoTombamento);

  return rows.map((r) => ({ ...r, nomeLeitor: r.nomeLeitor ?? null }));
}

export async function sugerirProximoCodigo(
  girotecaId: string,
  contexto: Contexto,
): Promise<string> {
  if (
    contexto.papel === "gestor_giroteca" &&
    girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .select({
      proximo:
        sql<number>`COALESCE(MAX(CASE WHEN ${exemplares.codigoTombamento} ~ '^[0-9]+$' THEN CAST(${exemplares.codigoTombamento} AS INTEGER) ELSE NULL END), 0) + 1`.mapWith(
          Number,
        ),
    })
    .from(exemplares)
    .where(eq(exemplares.girotecaId, girotecaId));

  return String(row?.proximo ?? 1);
}

export async function criarParaGiroteca(
  input: {
    livroId: string;
    girotecaId: string;
    codigoTombamento: string;
    estado?: "novo" | "bom" | "regular" | "danificado";
    observacoes?: string;
  },
  contexto: Contexto,
): Promise<Exemplar> {
  if (
    contexto.papel === "gestor_giroteca" &&
    input.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .insert(exemplares)
    .values({
      livroId: input.livroId,
      girotecaId: input.girotecaId,
      codigoTombamento: input.codigoTombamento,
      estado: input.estado ?? "bom",
      status: "disponivel",
      observacoes: input.observacoes,
    })
    .returning();
  return row;
}

export async function buscarPorTombamento(
  codigoTombamento: string,
  girotecaId: string,
  contexto: Contexto,
): Promise<Exemplar | null> {
  if (
    contexto.papel === "gestor_giroteca" &&
    girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .select()
    .from(exemplares)
    .where(
      and(
        eq(exemplares.codigoTombamento, codigoTombamento),
        eq(exemplares.girotecaId, girotecaId),
      ),
    );
  return row ?? null;
}

export async function mudarStatus(
  id: string,
  status: "disponivel" | "baixado",
  observacoes: string | undefined,
  contexto: Contexto,
): Promise<Exemplar> {
  const [exemplar] = await db
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, id));
  if (!exemplar) throw new AppError("Exemplar não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    exemplar.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  if (status === "baixado" && exemplar.status === "emprestado") {
    const [emprestimoAberto] = await db
      .select({ nomeLeitor: leitores.nome })
      .from(emprestimos)
      .innerJoin(leitores, eq(leitores.id, emprestimos.leitorId))
      .where(
        and(eq(emprestimos.exemplarId, id), isNull(emprestimos.dataDevolucao)),
      );
    const nome = emprestimoAberto?.nomeLeitor ?? "um leitor";
    throw new AppError(
      `Este exemplar está com ${nome}. Registre a devolução antes de baixar.`,
      409,
    );
  }

  const [updated] = await db
    .update(exemplares)
    .set({
      status,
      observacoes: observacoes ?? exemplar.observacoes,
      atualizadoEm: new Date(),
    })
    .where(eq(exemplares.id, id))
    .returning();
  return updated;
}
