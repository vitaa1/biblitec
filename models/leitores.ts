import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "db/index";
import { leitores } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Leitor = typeof leitores.$inferSelect;

export async function buscar(
  opts: { busca?: string } = {},
  contexto: Contexto,
): Promise<Leitor[]> {
  const conds = [];

  if (contexto.papel !== "admin_nthe") {
    conds.push(eq(leitores.girotecaId, contexto.girotecaId!));
  }
  if (opts.busca) {
    const t = `%${opts.busca.trim()}%`;
    conds.push(or(ilike(leitores.nome, t), ilike(leitores.matricula, t))!);
  }

  return db
    .select()
    .from(leitores)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(leitores.nome);
}

export async function criar(
  input: {
    girotecaId: string;
    nome: string;
    matricula: string;
    turma?: string;
    tipo?: "aluno" | "professor" | "funcionario";
    telefone?: string;
    responsavel?: string;
  },
  contexto: Contexto,
): Promise<Leitor> {
  if (
    contexto.papel === "gestor_giroteca" &&
    input.girotecaId !== contexto.girotecaId
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const [row] = await db
    .insert(leitores)
    .values({ tipo: "aluno", ativo: true, ...input })
    .returning();
  return row;
}

export async function atualizar(
  id: string,
  input: {
    nome?: string;
    turma?: string;
    telefone?: string;
    responsavel?: string;
  },
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

  const [updated] = await db
    .update(leitores)
    .set({ ...input, atualizadoEm: new Date() })
    .where(eq(leitores.id, id))
    .returning();
  return updated;
}

export async function desativar(
  id: string,
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

  const [updated] = await db
    .update(leitores)
    .set({ ativo: false, atualizadoEm: new Date() })
    .where(eq(leitores.id, id))
    .returning();
  return updated;
}
