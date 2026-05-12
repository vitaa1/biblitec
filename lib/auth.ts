import bcrypt from "bcryptjs";
import { jwtVerify } from "jose";
import jwt from "jsonwebtoken";
import { AppError } from "infra/errors";
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

export const SESSION_COOKIE_NAME = "biblitec_session";

const joseSecret = new TextEncoder().encode(env.JWT_SECRET);
const cookiePattern = new RegExp(
  `(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`,
);

export async function getCurrentUser(request: Request): Promise<Contexto | null> {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(cookiePattern);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], joseSecret);
    if (
      typeof payload.id !== "string" ||
      !payload.id ||
      (payload.papel !== "admin_nthe" && payload.papel !== "gestor_giroteca")
    ) {
      return null;
    }
    return {
      usuarioId: payload.id,
      papel: payload.papel as Contexto["papel"],
      girotecaId: (payload.girotecaId as string | null) ?? null,
    };
  } catch (err) {
    console.warn("[auth] token rejeitado:", (err as Error).name);
    return null;
  }
}

export function getUserFromHeaders(headers: Headers): Contexto | null {
  const usuarioId = headers.get("x-user-id");
  const papelRaw = headers.get("x-user-papel");
  if (!usuarioId || !papelRaw) return null;
  if (papelRaw !== "admin_nthe" && papelRaw !== "gestor_giroteca") return null;
  return {
    usuarioId,
    papel: papelRaw,
    girotecaId: headers.get("x-user-giroteca-id") || null,
  };
}

export function requireRole(
  contexto: Contexto | null,
  papel: Contexto["papel"],
): Contexto {
  if (!contexto) throw new AppError("Não autorizado.", 401);
  if (contexto.papel !== papel) throw new AppError("Acesso negado.", 403);
  return contexto;
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
