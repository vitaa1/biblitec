import { and, eq } from "drizzle-orm";
import { db } from "db/index";
import { usuarios } from "db/schema";
import { AppError } from "infra/errors";
import { hashSenha, verificarSenha } from "lib/auth";
import type { Contexto } from "lib/auth";

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

export type Usuario = typeof usuarios.$inferSelect;
export type UsuarioSemSenha = Omit<Usuario, "senhaHash">;

function omitirSenha(u: Usuario): UsuarioSemSenha {
  const { senhaHash: _, ...pub } = u;
  return pub;
}

export async function autenticar(
  email: string,
  senha: string,
): Promise<UsuarioSemSenha> {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(
      and(
        eq(usuarios.email, email.toLowerCase().trim()),
        eq(usuarios.ativo, true),
      ),
    );

  if (!usuario) throw new AppError("Credenciais inválidas.", 401);

  const senhaCorreta = await verificarSenha(senha, usuario.senhaHash);
  if (!senhaCorreta) throw new AppError("Credenciais inválidas.", 401);

  return omitirSenha(usuario);
}

export async function criar(
  input: {
    nome: string;
    email: string;
    senha: string;
    papel: "admin_nthe" | "gestor_giroteca";
    girotecaId?: string;
  },
  contexto: Contexto,
): Promise<UsuarioSemSenha> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }

  if (input.papel === "gestor_giroteca" && !input.girotecaId) {
    throw new AppError("Gestor precisa estar vinculado a uma giroteca.", 400);
  }

  const email = input.email.toLowerCase().trim();
  const senhaHash = await hashSenha(input.senha);

  try {
    const [row] = await db
      .insert(usuarios)
      .values({
        nome: input.nome,
        email,
        senhaHash,
        papel: input.papel,
        girotecaId: input.girotecaId,
        ativo: true,
      })
      .returning();
    return omitirSenha(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("Email já cadastrado.", 409);
    throw err;
  }
}

export async function buscarProprioPerfil(
  contexto: Contexto,
): Promise<UsuarioSemSenha> {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, contexto.usuarioId), eq(usuarios.ativo, true)));

  if (!usuario) throw new AppError("Usuário não encontrado.", 404);
  return omitirSenha(usuario);
}

export async function listarPorGiroteca(
  girotecaId: string,
  contexto: Contexto,
): Promise<UsuarioSemSenha[]> {
  if (contexto.papel !== "admin_nthe" && contexto.girotecaId !== girotecaId) {
    throw new AppError("Não autorizado.", 403);
  }

  const rows = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.girotecaId, girotecaId), eq(usuarios.ativo, true)));

  return rows.map(omitirSenha);
}
