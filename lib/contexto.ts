import type { Contexto } from "lib/auth";
import { AppError } from "infra/errors";

export function contextoFromRequest(request: Request): Contexto {
  const usuarioId = request.headers.get("x-user-id");
  const papel = request.headers.get("x-user-papel") as
    | "admin_nthe"
    | "gestor_giroteca"
    | null;
  const girotecaIdHeader = request.headers.get("x-user-giroteca-id");

  if (!usuarioId || !papel) {
    throw new AppError("Não autenticado.", 401);
  }

  return {
    usuarioId,
    papel,
    girotecaId: girotecaIdHeader || null,
  };
}
