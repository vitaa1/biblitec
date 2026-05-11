import { and, count, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "db/index";
import { emprestimos, exemplares, livros } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Livro = typeof livros.$inferSelect;

export async function buscar(
  opts: {
    busca?: string;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
  } = {},
): Promise<Livro[]> {
  const conds = [isNull(livros.deletadoEm)];

  if (opts.busca) {
    const t = `%${opts.busca.trim()}%`;
    conds.push(
      or(
        ilike(livros.titulo, t),
        ilike(livros.autores, t),
        ilike(livros.isbn, t),
      ) as SQL,
    );
  }
  if (opts.categoria) {
    conds.push(eq(livros.categoria, opts.categoria));
  }

  return db
    .select()
    .from(livros)
    .where(and(...conds))
    .orderBy(livros.titulo);
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
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
    capaUrl?: string;
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
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    categoria?: "Infantil" | "Juvenil" | "Didático" | "Literatura" | "Outros";
    capaUrl?: string;
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
