import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "lib/auth";

type RouteCtx = { pathname: string; method: string };

const publicRouteMatchers: Array<(ctx: RouteCtx) => boolean> = [
  ({ pathname }) => pathname === "/login",
  ({ pathname, method }) => pathname === "/api/v1/sessoes" && method === "POST",
  ({ pathname, method }) => pathname === "/api/v1/status" && method === "GET",
  ({ pathname, method }) =>
    pathname.startsWith("/api/v1/books") && method === "GET",
];

function stripUserHeaders(headers: Headers): Headers {
  const h = new Headers(headers);
  h.delete("x-user-id");
  h.delete("x-user-papel");
  h.delete("x-user-giroteca-id");
  return h;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Rotas públicas: strip de qualquer x-user-* enviado pelo cliente antes de passar
  if (publicRouteMatchers.some((m) => m({ pathname, method }))) {
    return NextResponse.next({
      request: { headers: stripUserHeaders(request.headers) },
    });
  }

  const contexto = await getCurrentUser(request);
  const isApiRoute = pathname.startsWith("/api/");

  if (!contexto) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ⚠ Limitação Edge Runtime: o JWT pode conter um girotecaId de giroteca
  // desativada após o login. Verificações críticas devem acontecer nos models/.

  if (pathname.startsWith("/admin/") && contexto.papel !== "admin_nthe") {
    if (isApiRoute) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Sobrescreve (não apenas seta) os headers x-user-* — garante que valores
  // injetados pelo cliente sejam sempre substituídos pelo JWT verificado.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", contexto.usuarioId);
  requestHeaders.set("x-user-papel", contexto.papel);
  requestHeaders.set("x-user-giroteca-id", contexto.girotecaId ?? "");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
