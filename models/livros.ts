import { and, count, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, livros } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Livro = typeof livros.$inferSelect;

export type LivroComExemplares = Livro & {
  qtdDisponiveis: number;
};

export const LIVROS_POR_PAGINA = 50;

type FiltrosLivro = {
  q?: string;
  isbn?: string;
  page?: number;
  limit?: number;
};

export async function buscarComFiltros(
  filtros: FiltrosLivro,
  contexto: Contexto,
): Promise<{ livros: LivroComExemplares[]; total: number }> {
  if (contexto.papel === "gestor_giroteca" && !contexto.girotecaId) {
    throw new AppError("Contexto inválido: gestor sem giroteca.", 500);
  }

  const page = Math.max(1, filtros.page ?? 1);
  const lim = Math.min(100, filtros.limit ?? LIVROS_POR_PAGINA);
  const offset = (page - 1) * lim;

  const conds: SQL[] = [isNull(livros.deletadoEm)];

  if (filtros.isbn) {
    conds.push(eq(livros.isbn, filtros.isbn.replace(/-/g, "")));
  } else if (filtros.q) {
    const t = `%${filtros.q.trim()}%`;
    conds.push(or(ilike(livros.titulo, t), ilike(livros.autores, t)) as SQL);
  }

  const where = and(...conds);

  // COUNT com FILTER evita N+1: uma única query agrega exemplares por livro.
  // Para gestor, restringe à própria giroteca. Para admin, contagem global.
  const qtdDisponiveisExpr =
    contexto.papel === "admin_nthe"
      ? sql<number>`COUNT(${exemplares.id}) FILTER (WHERE ${exemplares.status} = 'disponivel')`.mapWith(
          Number,
        )
      : sql<number>`COUNT(${exemplares.id}) FILTER (WHERE ${exemplares.status} = 'disponivel' AND ${exemplares.girotecaId} = ${contexto.girotecaId})`.mapWith(
          Number,
        );

  const [{ total }] = await db
    .select({ total: count() })
    .from(livros)
    .where(where);

  const rows = await db
    .select({
      id: livros.id,
      titulo: livros.titulo,
      autores: livros.autores,
      isbn: livros.isbn,
      editora: livros.editora,
      anoPublicacao: livros.anoPublicacao,
      categoria: livros.categoria,
      capaUrl: livros.capaUrl,
      origem: livros.origem,
      criadoPorGirotecaId: livros.criadoPorGirotecaId,
      criadoEm: livros.criadoEm,
      atualizadoEm: livros.atualizadoEm,
      deletadoEm: livros.deletadoEm,
      qtdDisponiveis: qtdDisponiveisExpr,
    })
    .from(livros)
    .leftJoin(exemplares, eq(exemplares.livroId, livros.id))
    .where(where)
    .groupBy(livros.id)
    .orderBy(livros.titulo)
    .limit(lim)
    .offset(offset);

  return { livros: rows as LivroComExemplares[], total: Number(total) };
}

export async function listarPorIsbn(isbn: string): Promise<Livro | null> {
  const [row] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.isbn, isbn), isNull(livros.deletadoEm)));
  return row ?? null;
}

export async function criar(
  input: {
    titulo: string;
    autores: string;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    capaUrl?: string;
    descricao?: string;
  },
  contexto: Contexto,
): Promise<Livro> {
  if (input.isbn) {
    const dup = await listarPorIsbn(input.isbn);
    if (dup) throw new AppError("ISBN já cadastrado.", 409);
  }

  const origem = contexto.papel === "admin_nthe" ? "central" : "local";

  const [row] = await db
    .insert(livros)
    .values({
      ...input,
      origem,
      criadoPorGirotecaId: origem === "local" ? contexto.girotecaId : null,
    })
    .returning();
  return row;
}

export async function atualizar(
  id: string,
  input: {
    titulo?: string;
    autores?: string;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    capaUrl?: string;
    descricao?: string;
  },
  contexto: Contexto,
): Promise<Livro> {
  const [existente] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.id, id), isNull(livros.deletadoEm)));
  if (!existente) throw new AppError("Livro não encontrado.", 404);

  if (contexto.papel === "gestor_giroteca") {
    if (existente.origem === "central") {
      throw new AppError("Não autorizado.", 403);
    }
    if (existente.criadoPorGirotecaId !== contexto.girotecaId) {
      throw new AppError("Não autorizado.", 403);
    }
  }

  if (input.isbn && input.isbn !== existente.isbn) {
    const dup = await listarPorIsbn(input.isbn);
    if (dup) throw new AppError("ISBN já cadastrado.", 409);
  }

  const [updated] = await db
    .update(livros)
    .set({ ...input, atualizadoEm: new Date() })
    .where(eq(livros.id, id))
    .returning();
  return updated;
}

export async function buscarPorId(id: string): Promise<Livro | null> {
  const [row] = await db
    .select()
    .from(livros)
    .where(and(eq(livros.id, id), isNull(livros.deletadoEm)));
  return row ?? null;
}

export async function remover(id: string, contexto: Contexto): Promise<void> {
  const existente = await buscarPorId(id);
  if (!existente) throw new AppError("Livro não encontrado.", 404);

  if (contexto.papel === "gestor_giroteca") {
    if (existente.origem === "central") {
      throw new AppError("Não autorizado.", 403);
    }
    if (existente.criadoPorGirotecaId !== contexto.girotecaId) {
      throw new AppError("Não autorizado.", 403);
    }
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(emprestimos)
    .innerJoin(exemplares, eq(emprestimos.exemplarId, exemplares.id))
    .where(and(eq(exemplares.livroId, id), isNull(emprestimos.dataDevolucao)));

  if (Number(total) > 0) {
    throw new AppError("Livro possui empréstimos em aberto.", 409);
  }

  await db
    .update(livros)
    .set({ deletadoEm: new Date() })
    .where(eq(livros.id, id));
}
