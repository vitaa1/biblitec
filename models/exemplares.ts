import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, leitores, livros } from "db/schema";
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

export type ExemplarBuscado = {
  exemplar: {
    id: string;
    codigoTombamento: string;
    status: "disponivel" | "emprestado" | "baixado";
    girotecaId: string;
  };
  livro: {
    titulo: string;
    autores: string;
    capaUrl: string | null;
  };
  leitorAtual?: {
    nome: string;
    turma: string | null;
    dataEmprestimo: Date;
  };
};

const ISBN_REGEX = /^\d{10}$|^\d{13}$/;

export async function buscarParaEmprestimo(
  query: string,
  contexto: Contexto,
): Promise<ExemplarBuscado | null> {
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    throw new AppError("Admin não opera empréstimos diretamente.", 400);
  }
  const girotecaId = contexto.girotecaId;
  const termo = query.trim();
  if (!termo) return null;

  let exemplarRow: typeof exemplares.$inferSelect | undefined;
  let livroRow: typeof livros.$inferSelect | undefined;

  if (ISBN_REGEX.test(termo)) {
    [livroRow] = await db
      .select()
      .from(livros)
      .where(and(eq(livros.isbn, termo), isNull(livros.deletadoEm)));
    if (!livroRow) return null;

    [exemplarRow] = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.livroId, livroRow.id),
          eq(exemplares.girotecaId, girotecaId),
          eq(exemplares.status, "disponivel"),
        ),
      )
      .limit(1);
    if (!exemplarRow) return null;
  } else {
    [exemplarRow] = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.codigoTombamento, termo),
          eq(exemplares.girotecaId, girotecaId),
        ),
      );
    if (!exemplarRow) return null;

    [livroRow] = await db
      .select()
      .from(livros)
      .where(eq(livros.id, exemplarRow.livroId));
    if (!livroRow) return null;
  }

  const resultado: ExemplarBuscado = {
    exemplar: {
      id: exemplarRow.id,
      codigoTombamento: exemplarRow.codigoTombamento,
      status: exemplarRow.status as "disponivel" | "emprestado" | "baixado",
      girotecaId: exemplarRow.girotecaId,
    },
    livro: {
      titulo: livroRow.titulo,
      autores: livroRow.autores,
      capaUrl: livroRow.capaUrl,
    },
  };

  if (exemplarRow.status === "emprestado") {
    const [emprestimoAtivo] = await db
      .select({
        dataEmprestimo: emprestimos.dataEmprestimo,
        nome: leitores.nome,
        turma: leitores.turma,
      })
      .from(emprestimos)
      .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
      .where(
        and(
          eq(emprestimos.exemplarId, exemplarRow.id),
          isNull(emprestimos.dataDevolucao),
        ),
      )
      .orderBy(desc(emprestimos.dataEmprestimo))
      .limit(1);

    if (emprestimoAtivo) {
      resultado.leitorAtual = {
        nome: emprestimoAtivo.nome,
        turma: emprestimoAtivo.turma,
        dataEmprestimo: emprestimoAtivo.dataEmprestimo,
      };
    }
  }

  return resultado;
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
