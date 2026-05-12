import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export async function contextoFromServerComponent(): Promise<Contexto> {
  const h = await headers();
  const usuarioId = h.get("x-user-id");
  const papelRaw = h.get("x-user-papel");
  const girotecaIdHeader = h.get("x-user-giroteca-id");

  if (!usuarioId) redirect("/login");

  if (papelRaw !== "admin_nthe" && papelRaw !== "gestor_giroteca") {
    redirect("/login");
  }

  return {
    usuarioId,
    papel: papelRaw,
    girotecaId: girotecaIdHeader || null,
  };
}
