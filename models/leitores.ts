import { and, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "db/index";
import { leitores } from "db/schema";
import { AppError, isDuplicateConstraint } from "infra/errors";
import type { Contexto } from "lib/auth";

const MATRICULA_CONSTRAINT = "leitores_matricula_giroteca_idx";

export type Leitor = typeof leitores.$inferSelect;

export type LeitorComContadores = Leitor & {
  emprestimosEmAberto: number;
  emprestimosAtrasados: number;
};

export type BuscarLeitoresInput = {
  busca?: string;
  girotecaId?: string;
  page?: number;
};

export type CriarLeitorInput = {
  girotecaId: string;
  nome: string;
  tipo?: "aluno" | "professor" | "funcionario";
  matricula?: string | null;
  turma?: string;
  telefone?: string;
  responsavel?: string;
};

export type AtualizarLeitorInput = {
  nome?: string;
  tipo?: "aluno" | "professor" | "funcionario";
  matricula?: string | null;
  turma?: string | null;
  telefone?: string | null;
  responsavel?: string | null;
};

export const LEITORES_POR_PAGINA = 50;

export async function buscar(
  filtros: BuscarLeitoresInput,
  contexto: Contexto,
): Promise<{ leitores: LeitorComContadores[]; total: number }> {
  const page = Math.max(1, filtros.page ?? 1);
  const offset = (page - 1) * LEITORES_POR_PAGINA;

  const conds: SQL[] = [eq(leitores.ativo, true)];

  if (contexto.papel !== "admin_nthe") {
    conds.push(eq(leitores.girotecaId, contexto.girotecaId!));
  } else if (filtros.girotecaId) {
    conds.push(eq(leitores.girotecaId, filtros.girotecaId));
  }

  if (filtros.busca) {
    const t = `%${filtros.busca.trim()}%`;
    conds.push(
      or(ilike(leitores.nome, t), ilike(leitores.matricula, t))! as SQL,
    );
  }

  const where = and(...conds);

  const [{ total }] = await db
    .select({ total: count() })
    .from(leitores)
    .where(where);

  const rows = await db
    .select({
      id: leitores.id,
      girotecaId: leitores.girotecaId,
      nome: leitores.nome,
      matricula: leitores.matricula,
      turma: leitores.turma,
      tipo: leitores.tipo,
      telefone: leitores.telefone,
      responsavel: leitores.responsavel,
      ativo: leitores.ativo,
      criadoEm: leitores.criadoEm,
      atualizadoEm: leitores.atualizadoEm,
      emprestimosEmAberto: sql<number>`(
        SELECT COUNT(*) FROM emprestimos e
        WHERE e.leitor_id = leitores.id
        AND e.data_devolucao IS NULL
      )`.mapWith(Number),
      emprestimosAtrasados: sql<number>`(
        SELECT COUNT(*) FROM emprestimos e
        WHERE e.leitor_id = leitores.id
        AND e.data_devolucao IS NULL
        AND e.data_prevista_devolucao < NOW()
      )`.mapWith(Number),
    })
    .from(leitores)
    .where(where)
    .orderBy(leitores.nome)
    .limit(LEITORES_POR_PAGINA)
    .offset(offset);

  return { leitores: rows, total };
}

export async function buscarPorId(
  id: string,
  contexto: Contexto,
): Promise<Leitor> {
  const [leitor] = await db.select().from(leitores).where(eq(leitores.id, id));
  if (!leitor) throw new AppError("Leitor não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    leitor.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  return leitor;
}

export async function criar(
  input: CriarLeitorInput,
  contexto: Contexto,
): Promise<Leitor> {
  if (
    contexto.papel === "gestor_giroteca" &&
    input.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  try {
    const [row] = await db
      .insert(leitores)
      .values({ tipo: "aluno", ativo: true, ...input })
      .returning();
    return row;
  } catch (err) {
    if (isDuplicateConstraint(err, MATRICULA_CONSTRAINT)) {
      throw new AppError(
        "Já existe um leitor com esta matrícula nesta giroteca.",
        409,
        "MATRICULA_DUPLICADA",
      );
    }
    throw err;
  }
}

export async function atualizar(
  id: string,
  input: AtualizarLeitorInput,
  contexto: Contexto,
): Promise<Leitor> {
  const [existente] = await db
    .select()
    .from(leitores)
    .where(eq(leitores.id, id));
  if (!existente) throw new AppError("Leitor não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    existente.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  try {
    const [updated] = await db
      .update(leitores)
      .set({ ...input, atualizadoEm: new Date() })
      .where(eq(leitores.id, id))
      .returning();
    return updated;
  } catch (err) {
    if (isDuplicateConstraint(err, MATRICULA_CONSTRAINT)) {
      throw new AppError(
        "Já existe um leitor com esta matrícula nesta giroteca.",
        409,
        "MATRICULA_DUPLICADA",
      );
    }
    throw err;
  }
}

export async function desativar(id: string, contexto: Contexto): Promise<void> {
  const [existente] = await db
    .select()
    .from(leitores)
    .where(eq(leitores.id, id));
  if (!existente) throw new AppError("Leitor não encontrado.", 404);

  if (
    contexto.papel === "gestor_giroteca" &&
    existente.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  await db
    .update(leitores)
    .set({ ativo: false, atualizadoEm: new Date() })
    .where(eq(leitores.id, id));
}
