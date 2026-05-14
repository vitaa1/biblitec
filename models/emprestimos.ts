import { and, count, eq, isNull, lt } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Emprestimo = typeof emprestimos.$inferSelect;

const MAX_EMPRESTIMOS_ATIVOS = 3;
const MAX_RENOVACOES = 2;
const DIAS_PRAZO = 14;

export async function criar(
  input: {
    exemplarId: string;
    leitorId: string;
    dataPrevistaDevolucao?: Date;
    observacoes?: string;
  },
  contexto: Contexto,
): Promise<Emprestimo> {
  return db.transaction(async (tx) => {
    const [exemplar] = await tx
      .select()
      .from(exemplares)
      .where(eq(exemplares.id, input.exemplarId))
      .for("update");

    if (!exemplar) throw new AppError("Exemplar não encontrado.", 404);

    if (
      contexto.papel === "gestor_giroteca" &&
      exemplar.girotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }

    if (exemplar.status !== "disponivel") {
      throw new AppError(
        "Exemplar não disponível para empréstimo.",
        409,
        "EXEMPLAR_INDISPONIVEL",
      );
    }

    const [leitor] = await tx
      .select()
      .from(leitores)
      .where(eq(leitores.id, input.leitorId));

    if (!leitor) throw new AppError("Leitor não encontrado.", 404);
    if (!leitor.ativo)
      throw new AppError("Leitor inativo.", 409, "LEITOR_INATIVO");

    const [{ total }] = await tx
      .select({ total: count() })
      .from(emprestimos)
      .where(
        and(
          eq(emprestimos.leitorId, input.leitorId),
          isNull(emprestimos.dataDevolucao),
        ),
      );

    if (Number(total) >= MAX_EMPRESTIMOS_ATIVOS) {
      throw new AppError(
        "Leitor já possui o máximo de empréstimos em aberto.",
        409,
        "LEITOR_LIMITE_ATINGIDO",
      );
    }

    const now = new Date();
    const [atrasado] = await tx
      .select()
      .from(emprestimos)
      .where(
        and(
          eq(emprestimos.leitorId, input.leitorId),
          isNull(emprestimos.dataDevolucao),
          lt(emprestimos.dataPrevistaDevolucao, now),
        ),
      );

    if (atrasado) {
      throw new AppError(
        "Leitor possui empréstimo em atraso.",
        409,
        "LEITOR_COM_ATRASO",
      );
    }

    let dataPrevistaDevolucao: Date;
    if (input.dataPrevistaDevolucao) {
      const inicioHoje = new Date(now);
      inicioHoje.setHours(0, 0, 0, 0);
      const limiteMax = new Date(inicioHoje);
      limiteMax.setDate(limiteMax.getDate() + 60);
      if (
        input.dataPrevistaDevolucao < inicioHoje ||
        input.dataPrevistaDevolucao > limiteMax
      ) {
        throw new AppError(
          "Data de devolução fora do permitido (hoje até 60 dias).",
          400,
        );
      }
      dataPrevistaDevolucao = input.dataPrevistaDevolucao;
    } else {
      dataPrevistaDevolucao = new Date(now);
      dataPrevistaDevolucao.setDate(dataPrevistaDevolucao.getDate() + DIAS_PRAZO);
    }

    await tx
      .update(exemplares)
      .set({ status: "emprestado", atualizadoEm: now })
      .where(eq(exemplares.id, input.exemplarId));

    const [row] = await tx
      .insert(emprestimos)
      .values({
        exemplarId: input.exemplarId,
        leitorId: input.leitorId,
        registradoPorId: contexto.usuarioId,
        dataPrevistaDevolucao,
        observacoes: input.observacoes,
      })
      .returning();

    return row;
  });
}

export async function devolver(
  id: string,
  contexto: Contexto,
): Promise<Emprestimo> {
  return db.transaction(async (tx) => {
    const [emprestimo] = await tx
      .select()
      .from(emprestimos)
      .where(and(eq(emprestimos.id, id), isNull(emprestimos.dataDevolucao)));

    if (!emprestimo) {
      throw new AppError("Empréstimo não encontrado ou já devolvido.", 404);
    }

    const [exemplar] = await tx
      .select()
      .from(exemplares)
      .where(eq(exemplares.id, emprestimo.exemplarId));

    if (!exemplar) throw new AppError("Exemplar não encontrado.", 500);

    if (
      contexto.papel === "gestor_giroteca" &&
      exemplar.girotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }

    const now = new Date();
    await tx
      .update(exemplares)
      .set({ status: "disponivel", atualizadoEm: now })
      .where(eq(exemplares.id, emprestimo.exemplarId));

    const [updated] = await tx
      .update(emprestimos)
      .set({ dataDevolucao: now })
      .where(eq(emprestimos.id, id))
      .returning();

    return updated;
  });
}

export async function renovar(
  id: string,
  contexto: Contexto,
): Promise<Emprestimo> {
  const [emprestimo] = await db
    .select()
    .from(emprestimos)
    .where(and(eq(emprestimos.id, id), isNull(emprestimos.dataDevolucao)));

  if (!emprestimo) {
    throw new AppError("Empréstimo não encontrado ou já devolvido.", 404);
  }

  const [exemplar] = await db
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, emprestimo.exemplarId));

  if (!exemplar) throw new AppError("Exemplar não encontrado.", 500);

  if (
    contexto.papel === "gestor_giroteca" &&
    exemplar.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  if (emprestimo.renovacoes >= MAX_RENOVACOES) {
    throw new AppError("Limite de renovações atingido.", 409);
  }

  const now = new Date();
  if (emprestimo.dataPrevistaDevolucao < now) {
    throw new AppError("Não é possível renovar empréstimo em atraso.", 409);
  }

  const novaData = new Date(emprestimo.dataPrevistaDevolucao);
  novaData.setDate(novaData.getDate() + DIAS_PRAZO);

  const [updated] = await db
    .update(emprestimos)
    .set({
      dataPrevistaDevolucao: novaData,
      renovacoes: emprestimo.renovacoes + 1,
    })
    .where(eq(emprestimos.id, id))
    .returning();

  return updated;
}

const emprestimoCols = {
  id: emprestimos.id,
  exemplarId: emprestimos.exemplarId,
  leitorId: emprestimos.leitorId,
  registradoPorId: emprestimos.registradoPorId,
  dataEmprestimo: emprestimos.dataEmprestimo,
  dataPrevistaDevolucao: emprestimos.dataPrevistaDevolucao,
  dataDevolucao: emprestimos.dataDevolucao,
  renovacoes: emprestimos.renovacoes,
  observacoes: emprestimos.observacoes,
  criadoEm: emprestimos.criadoEm,
};

export async function listarEmAberto(
  contexto: Contexto,
): Promise<Emprestimo[]> {
  if (contexto.papel === "admin_nthe") {
    return db
      .select()
      .from(emprestimos)
      .where(isNull(emprestimos.dataDevolucao))
      .orderBy(emprestimos.dataEmprestimo);
  }

  return db
    .select(emprestimoCols)
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        eq(exemplares.girotecaId, contexto.girotecaId!),
      ),
    )
    .orderBy(emprestimos.dataEmprestimo);
}

export async function listarAtrasados(
  contexto: Contexto,
): Promise<Emprestimo[]> {
  const now = new Date();

  if (contexto.papel === "admin_nthe") {
    return db
      .select()
      .from(emprestimos)
      .where(
        and(
          isNull(emprestimos.dataDevolucao),
          lt(emprestimos.dataPrevistaDevolucao, now),
        ),
      )
      .orderBy(emprestimos.dataPrevistaDevolucao);
  }

  return db
    .select(emprestimoCols)
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        lt(emprestimos.dataPrevistaDevolucao, now),
        eq(exemplares.girotecaId, contexto.girotecaId!),
      ),
    )
    .orderBy(emprestimos.dataPrevistaDevolucao);
}
