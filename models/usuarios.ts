import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "db/index";
import { usuarios } from "db/schema";
import { AppError } from "infra/errors";
import type { Contexto } from "lib/auth";

export type Usuario = typeof usuarios.$inferSelect;
export type UsuarioPublico = Omit<Usuario, "senhaHash">;

function omitirSenha(u: Usuario): UsuarioPublico {
  const { senhaHash: _, ...pub } = u;
  return pub;
}

export async function autenticar(
  email: string,
  senha: string,
): Promise<UsuarioPublico> {
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

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
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
): Promise<UsuarioPublico> {
  if (contexto.papel !== "admin_nthe") {
    throw new AppError("Não autorizado.", 403);
  }

  if (input.papel === "gestor_giroteca" && !input.girotecaId) {
    throw new AppError("Gestor precisa estar vinculado a uma giroteca.", 400);
  }

  const email = input.email.toLowerCase().trim();
  const [existente] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.email, email), eq(usuarios.ativo, true)));
  if (existente) throw new AppError("Email já cadastrado.", 409);

  const senhaHash = await bcrypt.hash(input.senha, 10);
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
}

export async function listarPorGiroteca(
  girotecaId: string,
  contexto: Contexto,
): Promise<UsuarioPublico[]> {
  if (contexto.papel !== "admin_nthe" && contexto.girotecaId !== girotecaId) {
    throw new AppError("Não autorizado.", 403);
  }

  const rows = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.girotecaId, girotecaId), eq(usuarios.ativo, true)));

  return rows.map(omitirSenha);
}
