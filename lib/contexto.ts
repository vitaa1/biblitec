import type { Contexto } from "lib/auth";
import { AppError } from "infra/errors";

export function contextoFromRequest(request: Request): Contexto {
  const usuarioId = request.headers.get("x-user-id");
  const papelRaw = request.headers.get("x-user-papel");
  const girotecaIdHeader = request.headers.get("x-user-giroteca-id");

  if (!usuarioId) throw new AppError("Não autenticado.", 401);

  if (papelRaw !== "admin_nthe" && papelRaw !== "gestor_giroteca") {
    throw new AppError("Não autenticado.", 401);
  }

  return {
    usuarioId,
    papel: papelRaw,
    girotecaId: girotecaIdHeader || null,
  };
}
