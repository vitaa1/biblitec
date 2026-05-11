import { jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "lib/env";

type RouteContext = { pathname: string; method: string };

const secret = new TextEncoder().encode(env.JWT_SECRET);

const publicRouteMatchers: Array<(ctx: RouteContext) => boolean> = [
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/login" && method === "POST",
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/logout" && method === "POST",
  ({ pathname, method }) => pathname === "/api/v1/status" && method === "GET",
  ({ pathname, method }) =>
    pathname.startsWith("/api/v1/books") && method === "GET",
];

// Rotas que exigem papel admin_nthe (verificado no middleware além do model)
const adminRouteMatchers: Array<(ctx: RouteContext) => boolean> = [
  ({ pathname }) => pathname.startsWith("/api/v1/migrations"),
  ({ pathname, method }) => pathname === "/api/v1/users" && method === "POST",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const isPublicRoute = publicRouteMatchers.some((m) =>
    m({ pathname, method }),
  );
  if (isPublicRoute) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as {
      id: string;
      papel: "admin_nthe" | "gestor_giroteca";
      girotecaId: string | null;
    };

    if (
      typeof decoded.id !== "string" ||
      !decoded.id ||
      (decoded.papel !== "admin_nthe" && decoded.papel !== "gestor_giroteca")
    ) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    const isAdminRoute = adminRouteMatchers.some((m) =>
      m({ pathname, method }),
    );
    if (isAdminRoute && decoded.papel !== "admin_nthe") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", decoded.id);
    requestHeaders.set("x-user-papel", decoded.papel);
    requestHeaders.set("x-user-giroteca-id", decoded.girotecaId ?? "");

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json(
      { error: "Token inválido ou expirado." },
      { status: 401 },
    );
  }
}

export const config = {
  matcher: "/api/v1/:path*",
};
