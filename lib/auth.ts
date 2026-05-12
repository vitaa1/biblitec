import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "lib/env";

export type Contexto = {
  usuarioId: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null;
};

export type TokenPayload = {
  id: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null;
};

export function assinarToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1d" });
}

export function verificarToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as Record<string, unknown>).id !== "string" ||
    ((payload as Record<string, unknown>).papel !== "admin_nthe" &&
      (payload as Record<string, unknown>).papel !== "gestor_giroteca")
  ) {
    throw new Error("Token com estrutura inválida.");
  }
  return payload as TokenPayload;
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(
  senha: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
