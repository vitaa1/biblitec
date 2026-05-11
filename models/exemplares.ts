import { and, eq } from "drizzle-orm";
import { db } from "db/index";
import { exemplares } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Exemplar = typeof exemplares.$inferSelect;

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
    throw new AppError(
      "Não é possível baixar exemplar com empréstimo em aberto.",
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
