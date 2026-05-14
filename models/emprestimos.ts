import { and, count, desc, eq, ilike, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, leitores, livros } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Emprestimo = typeof emprestimos.$inferSelect;

const MAX_EMPRESTIMOS_ATIVOS = 3;
export const MAX_RENOVACOES = 2;
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

    if (
      contexto.papel === "gestor_giroteca" &&
      leitor.girotecaId !== contexto.girotecaId
    ) {
      throw new AppError("Não autorizado.", 403);
    }

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
      // z.coerce.date() produz UTC midnight; comparar em UTC para evitar bug de timezone
      // (ex.: Teresina UTC-3 rejeitaria a data de hoje nas primeiras 3h do dia)
      const inicioHojeUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const limiteMaxUtc = new Date(inicioHojeUtc);
      limiteMaxUtc.setUTCDate(limiteMaxUtc.getUTCDate() + 60);
      if (
        input.dataPrevistaDevolucao < inicioHojeUtc ||
        input.dataPrevistaDevolucao > limiteMaxUtc
      ) {
        throw new AppError(
          "Data de devolução fora do permitido (hoje até 60 dias).",
          400,
        );
      }
      dataPrevistaDevolucao = input.dataPrevistaDevolucao;
    } else {
      dataPrevistaDevolucao = new Date(now);
      dataPrevistaDevolucao.setDate(
        dataPrevistaDevolucao.getDate() + DIAS_PRAZO,
      );
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
  opcoes?: { estadoRetorno?: "bom" | "regular" | "danificado" },
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
      .set({
        status: "disponivel",
        atualizadoEm: now,
        ...(opcoes?.estadoRetorno ? { estado: opcoes.estadoRetorno } : {}),
      })
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

export type EmprestimoParaDevolucao = {
  emprestimoId: string;
  exemplar: {
    id: string;
    codigoTombamento: string;
    estado: "novo" | "bom" | "regular" | "danificado";
  };
  livro: { titulo: string; autores: string; capaUrl: string | null };
  leitor: { nome: string; turma: string | null };
  dataEmprestimo: Date;
  dataPrevistaDevolucao: Date;
};

export type BuscaDevResult =
  | { ok: true; data: EmprestimoParaDevolucao }
  | {
      ok: false;
      code:
        | "NAO_ENCONTRADO"
        | "SEM_EMPRESTIMO_ABERTO"
        | "MULTIPLOS_EMPRESTADOS"
        | "EXEMPLAR_BAIXADO";
    };

const ISBN_REGEX_DEV = /^\d{10}$|^\d{13}$/;

export async function buscarParaDevolucao(
  query: string,
  contexto: Contexto,
): Promise<BuscaDevResult> {
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    throw new AppError("Admin não opera devoluções diretamente.", 400);
  }
  const girotecaId = contexto.girotecaId;
  const termo = query.trim();
  if (!termo) return { ok: false, code: "NAO_ENCONTRADO" };

  let exemplarRow: typeof exemplares.$inferSelect | undefined;

  if (ISBN_REGEX_DEV.test(termo)) {
    const [livroRow] = await db
      .select()
      .from(livros)
      .where(and(eq(livros.isbn, termo), isNull(livros.deletadoEm)));
    if (!livroRow) return { ok: false, code: "NAO_ENCONTRADO" };

    const emprestados = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.livroId, livroRow.id),
          eq(exemplares.girotecaId, girotecaId),
          eq(exemplares.status, "emprestado"),
        ),
      );

    if (emprestados.length === 0)
      return { ok: false, code: "SEM_EMPRESTIMO_ABERTO" };
    if (emprestados.length > 1)
      return { ok: false, code: "MULTIPLOS_EMPRESTADOS" };
    exemplarRow = emprestados[0];
  } else {
    const [row] = await db
      .select()
      .from(exemplares)
      .where(
        and(
          eq(exemplares.codigoTombamento, termo),
          eq(exemplares.girotecaId, girotecaId),
        ),
      );
    if (!row) return { ok: false, code: "NAO_ENCONTRADO" };
    if (row.status === "baixado")
      return { ok: false, code: "EXEMPLAR_BAIXADO" };
    if (row.status !== "emprestado")
      return { ok: false, code: "SEM_EMPRESTIMO_ABERTO" };
    exemplarRow = row;
  }

  const [dadosEmprestimo] = await db
    .select({
      emprestimoId: emprestimos.id,
      dataEmprestimo: emprestimos.dataEmprestimo,
      dataPrevistaDevolucao: emprestimos.dataPrevistaDevolucao,
      nomeLeitor: leitores.nome,
      turmaLeitor: leitores.turma,
      tituloLivro: livros.titulo,
      autoresLivro: livros.autores,
      capaUrlLivro: livros.capaUrl,
    })
    .from(emprestimos)
    .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
    .innerJoin(livros, eq(livros.id, exemplarRow.livroId))
    .where(
      and(
        eq(emprestimos.exemplarId, exemplarRow.id),
        isNull(emprestimos.dataDevolucao),
      ),
    )
    .limit(1);

  if (!dadosEmprestimo) return { ok: false, code: "SEM_EMPRESTIMO_ABERTO" };

  return {
    ok: true,
    data: {
      emprestimoId: dadosEmprestimo.emprestimoId,
      exemplar: {
        id: exemplarRow.id,
        codigoTombamento: exemplarRow.codigoTombamento,
        estado: exemplarRow.estado,
      },
      livro: {
        titulo: dadosEmprestimo.tituloLivro,
        autores: dadosEmprestimo.autoresLivro,
        capaUrl: dadosEmprestimo.capaUrlLivro,
      },
      leitor: {
        nome: dadosEmprestimo.nomeLeitor,
        turma: dadosEmprestimo.turmaLeitor,
      },
      dataEmprestimo: dadosEmprestimo.dataEmprestimo,
      dataPrevistaDevolucao: dadosEmprestimo.dataPrevistaDevolucao,
    },
  };
}

// ─── Listagem ────────────────────────────────────────────────────────────────

export type EmprestimoListagem = {
  id: string;
  leitor: { nome: string; turma: string | null; matricula: string | null };
  livro: { titulo: string };
  exemplar: { codigoTombamento: string };
  dataEmprestimo: Date;
  dataPrevistaDevolucao: Date;
  dataDevolucao: Date | null;
  renovacoes: number;
};

export type FiltrosListagem = {
  aba: "em_aberto" | "atrasados";
  busca?: string;
  turma?: string;
  page?: number;
};

export type ResultadoListagem = {
  items: EmprestimoListagem[];
  totalEmAberto: number;
  totalAtrasados: number;
};

export type FiltrosHistorico = {
  busca?: string;
  turma?: string;
  page?: number;
};

export type ResultadoHistorico = {
  items: EmprestimoListagem[];
  total: number;
};

const LISTAGEM_POR_PAGINA = 50;
const HIST_POR_PAGINA = 20;

const listSelect = {
  id: emprestimos.id,
  dataEmprestimo: emprestimos.dataEmprestimo,
  dataPrevistaDevolucao: emprestimos.dataPrevistaDevolucao,
  dataDevolucao: emprestimos.dataDevolucao,
  renovacoes: emprestimos.renovacoes,
  leitorNome: leitores.nome,
  leitorTurma: leitores.turma,
  leitorMatricula: leitores.matricula,
  livroTitulo: livros.titulo,
  exemplarCodigo: exemplares.codigoTombamento,
};

function mapListagem(row: {
  id: string;
  dataEmprestimo: Date;
  dataPrevistaDevolucao: Date;
  dataDevolucao: Date | null;
  renovacoes: number;
  leitorNome: string;
  leitorTurma: string | null;
  leitorMatricula: string | null;
  livroTitulo: string;
  exemplarCodigo: string;
}): EmprestimoListagem {
  return {
    id: row.id,
    leitor: { nome: row.leitorNome, turma: row.leitorTurma, matricula: row.leitorMatricula },
    livro: { titulo: row.livroTitulo },
    exemplar: { codigoTombamento: row.exemplarCodigo },
    dataEmprestimo: row.dataEmprestimo,
    dataPrevistaDevolucao: row.dataPrevistaDevolucao,
    dataDevolucao: row.dataDevolucao,
    renovacoes: row.renovacoes,
  };
}

export async function listarComFiltros(
  filtros: FiltrosListagem,
  contexto: Contexto,
): Promise<ResultadoListagem> {
  const { aba, busca, turma, page = 1 } = filtros;

  const now = new Date();
  const hoje = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const girotecaWhere =
    contexto.papel === "gestor_giroteca"
      ? eq(exemplares.girotecaId, contexto.girotecaId!)
      : undefined;

  const rows = await db
    .select(listSelect)
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
    .innerJoin(livros, eq(exemplares.livroId, livros.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        girotecaWhere,
        aba === "atrasados"
          ? lt(emprestimos.dataPrevistaDevolucao, hoje)
          : undefined,
        busca ? ilike(leitores.nome, `%${busca}%`) : undefined,
        turma ? eq(leitores.turma, turma) : undefined,
      ),
    )
    .orderBy(emprestimos.dataEmprestimo)
    .limit(LISTAGEM_POR_PAGINA)
    .offset((page - 1) * LISTAGEM_POR_PAGINA);

  const [{ total: totalEmAberto }] = await db
    .select({ total: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(and(isNull(emprestimos.dataDevolucao), girotecaWhere));

  const [{ total: totalAtrasados }] = await db
    .select({ total: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(
      and(
        isNull(emprestimos.dataDevolucao),
        lt(emprestimos.dataPrevistaDevolucao, hoje),
        girotecaWhere,
      ),
    );

  return {
    items: rows.map(mapListagem),
    totalEmAberto: Number(totalEmAberto),
    totalAtrasados: Number(totalAtrasados),
  };
}

export async function listarHistorico(
  filtros: FiltrosHistorico,
  contexto: Contexto,
): Promise<ResultadoHistorico> {
  const { busca, turma, page = 1 } = filtros;

  const girotecaWhere =
    contexto.papel === "gestor_giroteca"
      ? eq(exemplares.girotecaId, contexto.girotecaId!)
      : undefined;

  const whereClause = and(
    isNotNull(emprestimos.dataDevolucao),
    girotecaWhere,
    busca ? ilike(leitores.nome, `%${busca}%`) : undefined,
    turma ? eq(leitores.turma, turma) : undefined,
  );

  const rows = await db
    .select(listSelect)
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
    .innerJoin(livros, eq(exemplares.livroId, livros.id))
    .where(whereClause)
    .orderBy(desc(emprestimos.dataDevolucao))
    .limit(HIST_POR_PAGINA)
    .offset((page - 1) * HIST_POR_PAGINA);

  const [{ total }] = await db
    .select({ total: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .innerJoin(leitores, eq(emprestimos.leitorId, leitores.id))
    .where(whereClause);

  return {
    items: rows.map(mapListagem),
    total: Number(total),
  };
}
